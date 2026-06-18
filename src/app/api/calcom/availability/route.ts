import { NextRequest, NextResponse } from "next/server";
import { CalcomService } from "@/lib/calcom-service";
import { CalcomDatabaseError } from "@/lib/calcom-db-errors";

/**
 * GET /api/calcom/availability — Fetch available time slots from Cal.com
 *
 * Uses direct PostgreSQL access (ADR-6) via CalcomService.
 * Query params:
 *   - startTime (ISO 8601, required)
 *   - endTime   (ISO 8601, required)
 *   - scheduleId (optional, filter by schedule)
 *
 * Returns JSON with availabilities and existing bookings so the caller can
 * compute open slots.
 */
export async function GET(request: NextRequest) {
  const eventTypeId = process.env.CAL_COM_EVENT_TYPE_ID;
  if (!eventTypeId) {
    return NextResponse.json(
      { error: "CAL_COM_EVENT_TYPE_ID not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const startTime = searchParams.get("startTime");
  const endTime = searchParams.get("endTime");
  const scheduleId = searchParams.get("scheduleId");

  if (!startTime || !endTime) {
    return NextResponse.json(
      { error: "Les parametres startTime et endTime sont requis" },
      { status: 400 }
    );
  }

  // Validate ISO 8601 date format
  if (isNaN(Date.parse(startTime)) || isNaN(Date.parse(endTime))) {
    return NextResponse.json(
      {
        error:
          "Les parametres startTime et endTime doivent etre des dates ISO 8601 valides",
      },
      { status: 400 }
    );
  }

  try {
    const service = new CalcomService();

    // Fetch schedule availabilities (REQ-103, REQ-105)
    const availabilities = await service.getAvailabilities(
      scheduleId ? parseInt(scheduleId, 10) : undefined
    );

    // Fetch existing bookings in the date range (REQ-104)
    const bookings = await service.getBookings({
      eventTypeId: parseInt(eventTypeId, 10),
      startAfter: new Date(startTime),
      startBefore: new Date(endTime),
    });

    return NextResponse.json({
      availabilities,
      bookings: bookings.map((b) => ({
        id: b.id,
        uid: b.uid,
        title: b.title,
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        status: b.status,
      })),
    });
  } catch (error) {
    // Handle CalcomDatabaseError (duck-typed for module boundary compatibility)
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

    console.error("Availability route error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
