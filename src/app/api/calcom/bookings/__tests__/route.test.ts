import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  CalcomDatabaseError,
  PG_ERRORS,
  PgErrorType,
} from "@/lib/calcom-db-errors";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetEventTypes = vi.fn();
const mockGetBookings = vi.fn();
const mockCreateBooking = vi.fn();
const mockCreateAttendee = vi.fn();

vi.mock("@/lib/calcom-service", () => ({
  CalcomService: vi.fn().mockImplementation(() => ({
    getEventTypes: mockGetEventTypes,
    getBookings: mockGetBookings,
    createBooking: mockCreateBooking,
    createAttendee: mockCreateAttendee,
  })),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

async function importRoute() {
  vi.resetModules();
  vi.doMock("@/lib/calcom-service", () => ({
    CalcomService: vi.fn().mockImplementation(() => ({
      getEventTypes: mockGetEventTypes,
      getBookings: mockGetBookings,
      createBooking: mockCreateBooking,
      createAttendee: mockCreateAttendee,
    })),
  }));
  return await import("../route");
}

function createGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3001/api/calcom/bookings");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3001/api/calcom/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createInvalidJsonRequest(): NextRequest {
  return new NextRequest("http://localhost:3001/api/calcom/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json{",
  });
}

const mockBookingsList = [
  {
    id: 1,
    uid: "uid-1",
    title: "Consultation - Jean",
    startTime: new Date("2026-06-15T09:00:00Z"),
    endTime: new Date("2026-06-15T09:30:00Z"),
    status: "accepted",
    eventTypeId: 42,
    description: null,
  },
  {
    id: 2,
    uid: "uid-2",
    title: "Consultation - Marie",
    startTime: new Date("2026-06-15T10:00:00Z"),
    endTime: new Date("2026-06-15T10:30:00Z"),
    status: "accepted",
    eventTypeId: 42,
    description: "Suivi",
  },
];

const validPostBody = {
  start: "2026-06-15T09:00:00Z",
  name: "Jean Dupont",
  email: "jean@example.com",
  phone: "+33612345678",
};

const mockEventTypes = [
  {
    id: 42,
    title: "Consultation",
    slug: "consultation",
    length: 30,
    description: "Consultation generale",
  },
];

const mockBookingResult = {
  id: 1,
  uid: "test-uuid-1234",
  title: "Consultation - Jean Dupont",
  startTime: new Date("2026-06-15T09:00:00Z"),
  endTime: new Date("2026-06-15T09:30:00Z"),
  status: "accepted",
  eventTypeId: 42,
  description: null,
};

// ─── GET Tests ──────────────────────────────────────────────────────────────

describe("GET /api/calcom/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBookings.mockResolvedValue(mockBookingsList);
  });

  it("should return bookings list", async () => {
    const { GET } = await importRoute();

    const response = await GET(createGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.bookings).toHaveLength(2);
    expect(body.bookings[0].uid).toBe("uid-1");
    expect(body.bookings[0].startTime).toBe("2026-06-15T09:00:00.000Z");
    expect(body.bookings[1].description).toBe("Suivi");
  });

  it("should pass eventTypeId filter", async () => {
    const { GET } = await importRoute();

    await GET(createGetRequest({ eventTypeId: "42" }));

    expect(mockGetBookings).toHaveBeenCalledWith(
      expect.objectContaining({ eventTypeId: 42 })
    );
  });

  it("should pass startAfter filter", async () => {
    const { GET } = await importRoute();

    await GET(createGetRequest({ startAfter: "2026-06-15T00:00:00Z" }));

    expect(mockGetBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        startAfter: new Date("2026-06-15T00:00:00Z"),
      })
    );
  });

  it("should pass startBefore filter", async () => {
    const { GET } = await importRoute();

    await GET(createGetRequest({ startBefore: "2026-06-16T00:00:00Z" }));

    expect(mockGetBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        startBefore: new Date("2026-06-16T00:00:00Z"),
      })
    );
  });

  it("should return 400 for invalid startAfter date", async () => {
    const { GET } = await importRoute();

    const response = await GET(
      createGetRequest({ startAfter: "not-a-date" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("startAfter");
  });

  it("should return 400 for invalid startBefore date", async () => {
    const { GET } = await importRoute();

    const response = await GET(
      createGetRequest({ startBefore: "not-a-date" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("startBefore");
  });

  it("should return 400 for invalid eventTypeId", async () => {
    const { GET } = await importRoute();

    const response = await GET(createGetRequest({ eventTypeId: "abc" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("eventTypeId");
  });

  it("should return empty bookings array when no results", async () => {
    const { GET } = await importRoute();
    mockGetBookings.mockResolvedValueOnce([]);

    const response = await GET(createGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.bookings).toHaveLength(0);
  });

  // ─── Database errors ──────────────────────────────────────────────

  it("should return 504 on database timeout", async () => {
    const { GET } = await importRoute();
    mockGetBookings.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.TIMEOUT])
    );

    const response = await GET(createGetRequest());

    expect(response.status).toBe(504);
  });

  it("should return 503 on database connection refused", async () => {
    const { GET } = await importRoute();
    mockGetBookings.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.CONNECTION_REFUSED])
    );

    const response = await GET(createGetRequest());

    expect(response.status).toBe(503);
  });

  it("should return 500 on unknown database error", async () => {
    const { GET } = await importRoute();
    mockGetBookings.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.UNKNOWN])
    );

    const response = await GET(createGetRequest());

    expect(response.status).toBe(500);
  });

  it("should return 500 for unexpected errors", async () => {
    const { GET } = await importRoute();
    mockGetBookings.mockRejectedValueOnce(new Error("Unexpected"));

    const response = await GET(createGetRequest());

    expect(response.status).toBe(500);
  });
});

// ─── POST Tests ─────────────────────────────────────────────────────────────

describe("POST /api/calcom/bookings", () => {
  const originalRandomUUID = crypto.randomUUID;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CAL_COM_EVENT_TYPE_ID = "42";

    crypto.randomUUID = () =>
      "test-uuid-1234" as ReturnType<typeof crypto.randomUUID>;

    mockGetEventTypes.mockResolvedValue(mockEventTypes);
    mockCreateBooking.mockResolvedValue(mockBookingResult);
    mockCreateAttendee.mockResolvedValue({
      id: 1,
      bookingId: 1,
      name: "Jean Dupont",
      email: "jean@example.com",
      phone: "+33612345678",
      timeZone: "Europe/Paris",
      locale: "fr",
    });
  });

  afterEach(() => {
    delete process.env.CAL_COM_EVENT_TYPE_ID;
    crypto.randomUUID = originalRandomUUID;
  });

  // ─── Config errors ──────────────────────────────────────────────────

  it("should return 500 when CAL_COM_EVENT_TYPE_ID is not configured", async () => {
    delete process.env.CAL_COM_EVENT_TYPE_ID;
    const { POST } = await importRoute();

    const response = await POST(createPostRequest(validPostBody));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("CAL_COM_EVENT_TYPE_ID not configured");
  });

  // ─── JSON parse errors ──────────────────────────────────────────────

  it("should return 400 for invalid JSON body", async () => {
    const { POST } = await importRoute();

    const response = await POST(createInvalidJsonRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("JSON");
  });

  // ─── Validation ─────────────────────────────────────────────────────

  it("should return 400 when 'start' is missing", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ name: "Jean", email: "jean@example.com" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(
      expect.arrayContaining([expect.stringContaining("start")])
    );
  });

  it("should return 400 when 'start' is not a valid date", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ ...validPostBody, start: "not-a-date" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(
      expect.arrayContaining([expect.stringContaining("ISO 8601")])
    );
  });

  it("should return 400 when 'name' is missing", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({
        start: "2026-06-15T09:00:00Z",
        email: "jean@example.com",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(
      expect.arrayContaining([expect.stringContaining("name")])
    );
  });

  it("should return 400 when 'email' is missing", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ start: "2026-06-15T09:00:00Z", name: "Jean" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(
      expect.arrayContaining([expect.stringContaining("email")])
    );
  });

  it("should return 400 when 'email' is invalid", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ ...validPostBody, email: "not-an-email" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(
      expect.arrayContaining([expect.stringContaining("email")])
    );
  });

  it("should return 400 when 'phone' is an invalid French number", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createPostRequest({ ...validPostBody, phone: "+1 555 123 4567" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(
      expect.arrayContaining([expect.stringContaining("telephone")])
    );
  });

  it("should return 400 when multiple fields are invalid", async () => {
    const { POST } = await importRoute();

    const response = await POST(createPostRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details.length).toBeGreaterThanOrEqual(3);
  });

  // ─── Successful booking ─────────────────────────────────────────────

  it("should return 201 with booking data on success", async () => {
    const { POST } = await importRoute();

    const response = await POST(createPostRequest(validPostBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe(1);
    expect(body.uid).toBe("test-uuid-1234");
    expect(body.title).toBe("Consultation - Jean Dupont");
    expect(body.startTime).toBe("2026-06-15T09:00:00.000Z");
    expect(body.endTime).toBe("2026-06-15T09:30:00.000Z");
    expect(body.status).toBe("accepted");
  });

  it("should call createBooking with correct parameters", async () => {
    const { POST } = await importRoute();

    await POST(createPostRequest(validPostBody));

    expect(mockCreateBooking).toHaveBeenCalledWith({
      uid: "test-uuid-1234",
      title: "Consultation - Jean Dupont",
      startTime: new Date("2026-06-15T09:00:00Z"),
      endTime: new Date("2026-06-15T09:30:00Z"),
      eventTypeId: 42,
      description: undefined,
    });
  });

  it("should call createAttendee with correct parameters", async () => {
    const { POST } = await importRoute();

    await POST(createPostRequest(validPostBody));

    expect(mockCreateAttendee).toHaveBeenCalledWith({
      bookingId: 1,
      name: "Jean Dupont",
      email: "jean@example.com",
      phone: "+33612345678",
      timeZone: "Europe/Paris",
      locale: "fr",
    });
  });

  it("should accept request without optional phone field", async () => {
    const { POST } = await importRoute();

    const { phone: _, ...bodyWithoutPhone } = validPostBody;
    const response = await POST(createPostRequest(bodyWithoutPhone));

    expect(response.status).toBe(201);
    expect(mockCreateAttendee).toHaveBeenCalledWith(
      expect.objectContaining({ phone: undefined })
    );
  });

  it("should use eventTypeId from body when provided", async () => {
    const { POST } = await importRoute();
    const eventType99 = {
      id: 99,
      title: "Suivi",
      slug: "suivi",
      length: 15,
      description: null,
    };
    mockGetEventTypes.mockResolvedValueOnce([...mockEventTypes, eventType99]);
    mockCreateBooking.mockResolvedValueOnce({
      ...mockBookingResult,
      eventTypeId: 99,
      title: "Suivi - Jean Dupont",
      endTime: new Date("2026-06-15T09:15:00Z"),
    });

    const response = await POST(
      createPostRequest({ ...validPostBody, eventTypeId: 99 })
    );

    expect(response.status).toBe(201);
    expect(mockCreateBooking).toHaveBeenCalledWith(
      expect.objectContaining({ eventTypeId: 99 })
    );
  });

  // ─── Event type not found ──────────────────────────────────────────

  it("should return 404 when event type is not found", async () => {
    const { POST } = await importRoute();
    mockGetEventTypes.mockResolvedValueOnce([]);

    const response = await POST(createPostRequest(validPostBody));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("introuvable");
  });

  // ─── Database errors ──────────────────────────────────────────────

  it("should return 504 on database timeout", async () => {
    const { POST } = await importRoute();
    mockGetEventTypes.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.TIMEOUT])
    );

    const response = await POST(createPostRequest(validPostBody));

    expect(response.status).toBe(504);
  });

  it("should return 503 on database connection refused", async () => {
    const { POST } = await importRoute();
    mockGetEventTypes.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.CONNECTION_REFUSED])
    );

    const response = await POST(createPostRequest(validPostBody));

    expect(response.status).toBe(503);
  });

  it("should return 500 on unknown database error", async () => {
    const { POST } = await importRoute();
    mockGetEventTypes.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.UNKNOWN])
    );

    const response = await POST(createPostRequest(validPostBody));

    expect(response.status).toBe(500);
  });

  it("should return 500 for unexpected errors", async () => {
    const { POST } = await importRoute();
    mockGetEventTypes.mockRejectedValueOnce(new Error("Unexpected"));

    const response = await POST(createPostRequest(validPostBody));

    expect(response.status).toBe(500);
  });
});
