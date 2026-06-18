import { NextRequest, NextResponse } from "next/server";
import { CalcomService } from "@/lib/calcom-service";
import { CalcomDatabaseError } from "@/lib/calcom-db-errors";
import {
  isValidEmail,
  isValidFrenchPhone,
} from "@/lib/patient-validation";

interface BookingRequestBody {
  start: string;
  name: string;
  email: string;
  phone?: string;
  eventTypeId?: number;
}

/**
 * GET /api/calcom/bookings — List existing bookings from Cal.com (REQ-104).
 *
 * Uses direct PostgreSQL access (ADR-6) via CalcomService.
 * Query params:
 *   - eventTypeId (optional)
 *   - startAfter  (ISO 8601, optional)
 *   - startBefore (ISO 8601, optional)
 *
 * Returns JSON array of bookings.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventTypeIdParam = searchParams.get("eventTypeId");
  const startAfter = searchParams.get("startAfter");
  const startBefore = searchParams.get("startBefore");

  // Validate date params if provided
  if (startAfter && isNaN(Date.parse(startAfter))) {
    return NextResponse.json(
      { error: "Le parametre startAfter doit etre une date ISO 8601 valide" },
      { status: 400 }
    );
  }
  if (startBefore && isNaN(Date.parse(startBefore))) {
    return NextResponse.json(
      { error: "Le parametre startBefore doit etre une date ISO 8601 valide" },
      { status: 400 }
    );
  }
  if (eventTypeIdParam && isNaN(parseInt(eventTypeIdParam, 10))) {
    return NextResponse.json(
      { error: "Le parametre eventTypeId doit etre un nombre entier" },
      { status: 400 }
    );
  }

  try {
    const service = new CalcomService();

    const bookings = await service.getBookings({
      eventTypeId: eventTypeIdParam
        ? parseInt(eventTypeIdParam, 10)
        : undefined,
      startAfter: startAfter ? new Date(startAfter) : undefined,
      startBefore: startBefore ? new Date(startBefore) : undefined,
    });

    return NextResponse.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        uid: b.uid,
        title: b.title,
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        status: b.status,
        eventTypeId: b.eventTypeId,
        description: b.description,
      })),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "CalcomDatabaseError" &&
      "errorInfo" in error
    ) {
      const dbError = error as CalcomDatabaseError;
      console.error(
        "Cal.com DB error:",
        dbError.errorInfo.code,
        dbError.message,
        "cause:",
        dbError.cause
      );

      const status =
        dbError.errorInfo.code === "CALCOM_DB_TIMEOUT"
          ? 504
          : dbError.errorInfo.code === "CALCOM_DB_CONNECTION_REFUSED"
            ? 503
            : 500;

      return NextResponse.json({ error: dbError.errorInfo.message }, { status });
    }

    console.error("Bookings route error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calcom/bookings — Create a new booking (REQ-106, REQ-107).
 *
 * Uses direct PostgreSQL access (ADR-6) via CalcomService.
 * Body: { start, name, email, phone?, eventTypeId? }
 *
 * Inserts into Cal.com "Booking" + "Attendee" tables directly.
 * Falls back to CAL_COM_EVENT_TYPE_ID env var if eventTypeId not in body.
 */
export async function POST(request: NextRequest) {
  const defaultEventTypeId = process.env.CAL_COM_EVENT_TYPE_ID;

  let body: BookingRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requete JSON invalide" },
      { status: 400 }
    );
  }

  // Resolve event type ID: body override or env default
  const eventTypeId =
    body.eventTypeId ??
    (defaultEventTypeId ? parseInt(defaultEventTypeId, 10) : undefined);
  if (!eventTypeId || isNaN(eventTypeId)) {
    return NextResponse.json(
      { error: "CAL_COM_EVENT_TYPE_ID not configured" },
      { status: 500 }
    );
  }

  // ─── Validate input ────────────────────────────────────────────────
  const errors: string[] = [];

  if (!body.start || typeof body.start !== "string") {
    errors.push("Le champ 'start' est requis (date ISO 8601)");
  } else if (isNaN(Date.parse(body.start))) {
    errors.push("Le champ 'start' doit etre une date ISO 8601 valide");
  }

  if (
    !body.name ||
    typeof body.name !== "string" ||
    body.name.trim() === ""
  ) {
    errors.push("Le champ 'name' est requis");
  }

  if (!body.email || typeof body.email !== "string") {
    errors.push("Le champ 'email' est requis");
  } else if (!isValidEmail(body.email)) {
    errors.push(
      "L'adresse email semble invalide. Elle doit etre au format nom@exemple.fr."
    );
  }

  if (body.phone !== undefined && typeof body.phone !== "string") {
    errors.push("Le champ 'phone' doit etre une chaine de caracteres");
  } else if (
    body.phone &&
    typeof body.phone === "string" &&
    body.phone.trim() !== "" &&
    !isValidFrenchPhone(body.phone)
  ) {
    errors.push(
      "Le numero de telephone semble invalide. Il doit etre un numero francais a 10 chiffres, par exemple 06 12 34 56 78."
    );
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Donnees invalides", details: errors },
      { status: 400 }
    );
  }

  // ─── Create booking + attendee via PostgreSQL ─────────────────────
  try {
    const service = new CalcomService();

    // Fetch event type to get duration for endTime calculation
    const eventTypes = await service.getEventTypes();
    const eventType = eventTypes.find((et) => et.id === eventTypeId);
    if (!eventType) {
      return NextResponse.json(
        { error: `Type d'evenement introuvable (id=${eventTypeId})` },
        { status: 404 }
      );
    }

    const startTime = new Date(body.start);
    const endTime = new Date(startTime.getTime() + eventType.length * 60_000);
    const uid = crypto.randomUUID();

    // INSERT into "Booking" (REQ-106)
    const booking = await service.createBooking({
      uid,
      title: `${eventType.title} - ${body.name.trim()}`,
      startTime,
      endTime,
      eventTypeId,
      description: undefined,
    });

    // INSERT into "Attendee" (REQ-107)
    await service.createAttendee({
      bookingId: booking.id,
      name: body.name.trim(),
      email: body.email.trim(),
      phone: body.phone?.trim(),
      timeZone: "Europe/Paris",
      locale: "fr",
    });

    return NextResponse.json(
      {
        id: booking.id,
        uid: booking.uid,
        title: booking.title,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        status: booking.status,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "CalcomDatabaseError" &&
      "errorInfo" in error
    ) {
      const dbError = error as CalcomDatabaseError;
      console.error(
        "Cal.com DB error:",
        dbError.errorInfo.code,
        dbError.message,
        "cause:",
        dbError.cause
      );

      const status =
        dbError.errorInfo.code === "CALCOM_DB_TIMEOUT"
          ? 504
          : dbError.errorInfo.code === "CALCOM_DB_CONNECTION_REFUSED"
            ? 503
            : 500;

      return NextResponse.json(
        { error: dbError.errorInfo.message },
        { status }
      );
    }

    console.error("Bookings route error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
