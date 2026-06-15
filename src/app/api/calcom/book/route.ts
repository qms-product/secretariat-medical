import { NextRequest, NextResponse } from "next/server";
import {
  createBooking,
  CalcomApiError,
  CalcomTimeoutError,
} from "@/lib/calcom";

interface BookingRequestBody {
  start: string;
  name: string;
  email: string;
  phone?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/calcom/book — Create a booking in Cal.com
 * Body: { start, name, email, phone? }
 * Returns booking confirmation. API key stays server-side (REQ-47).
 * Patient data transits server-side only (REQ-54).
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.CAL_COM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "CAL_COM_API_KEY not configured" },
      { status: 500 }
    );
  }

  const eventTypeId = process.env.CAL_COM_EVENT_TYPE_ID;
  if (!eventTypeId) {
    return NextResponse.json(
      { error: "CAL_COM_EVENT_TYPE_ID not configured" },
      { status: 500 }
    );
  }

  let body: BookingRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requete JSON invalide" },
      { status: 400 }
    );
  }

  // Validate required fields
  const errors: string[] = [];

  if (!body.start || typeof body.start !== "string") {
    errors.push("Le champ 'start' est requis (date ISO 8601)");
  } else if (isNaN(Date.parse(body.start))) {
    errors.push("Le champ 'start' doit etre une date ISO 8601 valide");
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    errors.push("Le champ 'name' est requis");
  }

  if (!body.email || typeof body.email !== "string") {
    errors.push("Le champ 'email' est requis");
  } else if (!isValidEmail(body.email)) {
    errors.push("Le champ 'email' doit etre une adresse email valide");
  }

  if (body.phone !== undefined && typeof body.phone !== "string") {
    errors.push("Le champ 'phone' doit etre une chaine de caracteres");
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Donnees invalides", details: errors },
      { status: 400 }
    );
  }

  try {
    const data = await createBooking({
      eventTypeId: parseInt(eventTypeId, 10),
      start: body.start,
      name: body.name.trim(),
      email: body.email.trim(),
      phone: body.phone?.trim(),
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof CalcomTimeoutError) {
      console.error("Cal.com booking timeout");
      return NextResponse.json(
        { error: "Le service Cal.com ne repond pas. Veuillez reessayer." },
        { status: 504 }
      );
    }

    if (error instanceof CalcomApiError) {
      console.error(`Cal.com booking error [${error.status}]:`, error.body);

      if (error.status === 409) {
        return NextResponse.json(
          { error: "Ce creneau n'est plus disponible" },
          { status: 409 }
        );
      }

      const httpStatus =
        error.status === 429
          ? 429
          : error.status === 503 || error.status === 502 || error.status === 504
            ? 503
            : 502;

      return NextResponse.json(
        { error: "Erreur lors de la creation du rendez-vous" },
        { status: httpStatus }
      );
    }

    console.error("Book route error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
