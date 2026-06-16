import { NextRequest, NextResponse } from "next/server";
import {
  getAvailability,
  CalcomApiError,
  CalcomTimeoutError,
} from "@/lib/calcom";

/**
 * GET /api/calcom/availability — Fetch available time slots from Cal.com
 * Query params: startTime, endTime (ISO 8601 strings)
 * Returns JSON with available slots. API key stays server-side (REQ-47).
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const startTime = searchParams.get("startTime");
  const endTime = searchParams.get("endTime");

  if (!startTime || !endTime) {
    return NextResponse.json(
      { error: "Les parametres startTime et endTime sont requis" },
      { status: 400 }
    );
  }

  // Validate ISO 8601 date format
  if (isNaN(Date.parse(startTime)) || isNaN(Date.parse(endTime))) {
    return NextResponse.json(
      { error: "Les parametres startTime et endTime doivent etre des dates ISO 8601 valides" },
      { status: 400 }
    );
  }

  try {
    const data = await getAvailability(startTime, endTime);

    // Sort slots by date key, then by time within each date (AC: créneaux triés par date/heure croissante)
    const sortedSlots: Record<string, { time: string }[]> = {};
    const sortedDates = Object.keys(data.slots).sort();
    for (const date of sortedDates) {
      sortedSlots[date] = [...data.slots[date]].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      );
    }

    return NextResponse.json({ slots: sortedSlots });
  } catch (error) {
    if (error instanceof CalcomTimeoutError) {
      console.error("Cal.com availability timeout");
      return NextResponse.json(
        { error: "Le service Cal.com ne repond pas. Veuillez reessayer." },
        { status: 504 }
      );
    }

    if (error instanceof CalcomApiError) {
      console.error(`Cal.com availability error [${error.status}]:`, error.body);

      const httpStatus =
        error.status === 429
          ? 429
          : error.status === 503 || error.status === 502 || error.status === 504
            ? 503
            : 502;

      return NextResponse.json(
        { error: "Erreur lors de la recuperation des disponibilites" },
        { status: httpStatus }
      );
    }

    console.error("Availability route error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
