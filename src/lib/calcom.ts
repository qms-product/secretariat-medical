/**
 * Cal.com API v2 service layer (ADR-6 / IMP-21).
 * Encapsulates all Cal.com API calls server-side.
 * API keys are never exposed to the client.
 */

const CALCOM_TIMEOUT_MS = 15_000;

export interface CalcomSlot {
  time: string;
}

export interface CalcomAvailabilityResponse {
  slots: Record<string, CalcomSlot[]>;
}

export interface CalcomBookingRequest {
  eventTypeId: number;
  start: string;
  name: string;
  email: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface CalcomBookingResponse {
  id: number;
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
}

export class CalcomApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Cal.com API error [${status}]: ${body}`);
    this.name = "CalcomApiError";
  }
}

export class CalcomTimeoutError extends Error {
  constructor() {
    super("Cal.com API request timed out");
    this.name = "CalcomTimeoutError";
  }
}

function getConfig() {
  const apiKey = process.env.CAL_COM_API_KEY;
  const baseUrl = process.env.CAL_COM_BASE_URL || "http://localhost:3000";
  const eventTypeId = process.env.CAL_COM_EVENT_TYPE_ID;
  return { apiKey, baseUrl, eventTypeId };
}

/**
 * Fetches available time slots from Cal.com for a given date range.
 */
export async function getAvailability(
  startTime: string,
  endTime: string
): Promise<CalcomAvailabilityResponse> {
  const { apiKey, baseUrl, eventTypeId } = getConfig();

  if (!apiKey) {
    throw new Error("CAL_COM_API_KEY not configured");
  }
  if (!eventTypeId) {
    throw new Error("CAL_COM_EVENT_TYPE_ID not configured");
  }

  const url = new URL("/v2/slots/available", baseUrl);
  url.searchParams.set("startTime", startTime);
  url.searchParams.set("endTime", endTime);
  url.searchParams.set("eventTypeId", eventTypeId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CALCOM_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new CalcomApiError(response.status, body);
    }

    const data = await response.json();
    return data as CalcomAvailabilityResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CalcomTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Creates a booking in Cal.com.
 */
export async function createBooking(
  request: CalcomBookingRequest
): Promise<CalcomBookingResponse> {
  const { apiKey, baseUrl } = getConfig();

  if (!apiKey) {
    throw new Error("CAL_COM_API_KEY not configured");
  }

  const url = new URL("/v2/bookings", baseUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CALCOM_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventTypeId: request.eventTypeId,
        start: request.start,
        attendee: {
          name: request.name,
          email: request.email,
          phoneNumber: request.phone,
        },
        metadata: request.metadata || {},
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new CalcomApiError(response.status, body);
    }

    const data = await response.json();
    return data as CalcomBookingResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CalcomTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
