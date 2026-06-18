import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { CalcomDatabaseError, PG_ERRORS, PgErrorType } from "@/lib/calcom-db-errors";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetEventTypes = vi.fn();
const mockCreateBooking = vi.fn();
const mockCreateAttendee = vi.fn();

vi.mock("@/lib/calcom-service", () => ({
  CalcomService: vi.fn().mockImplementation(() => ({
    getEventTypes: mockGetEventTypes,
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
      createBooking: mockCreateBooking,
      createAttendee: mockCreateAttendee,
    })),
  }));
  return await import("../route");
}

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3001/api/calcom/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createInvalidJsonRequest(): NextRequest {
  return new NextRequest("http://localhost:3001/api/calcom/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json{",
  });
}

const validBody = {
  start: "2026-06-15T09:00:00Z",
  name: "Jean Dupont",
  email: "jean@example.com",
  phone: "+33612345678",
};

const mockEventTypes = [
  { id: 42, title: "Consultation", slug: "consultation", length: 30, description: "Consultation generale" },
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/calcom/book (PostgreSQL)", () => {
  const originalRandomUUID = crypto.randomUUID;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CAL_COM_EVENT_TYPE_ID = "42";

    // Stub crypto.randomUUID for deterministic UIDs
    crypto.randomUUID = () => "test-uuid-1234" as ReturnType<typeof crypto.randomUUID>;

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

    const response = await POST(createRequest(validBody));
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

    const response = await POST(createRequest({ name: "Jean", email: "jean@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(expect.arrayContaining([expect.stringContaining("start")]));
  });

  it("should return 400 when 'start' is not a valid date", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ ...validBody, start: "not-a-date" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(expect.arrayContaining([expect.stringContaining("ISO 8601")]));
  });

  it("should return 400 when 'name' is missing", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ start: "2026-06-15T09:00:00Z", email: "jean@example.com" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(expect.arrayContaining([expect.stringContaining("name")]));
  });

  it("should return 400 when 'email' is missing", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ start: "2026-06-15T09:00:00Z", name: "Jean" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(expect.arrayContaining([expect.stringContaining("email")]));
  });

  it("should return 400 when 'email' is invalid", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ ...validBody, email: "not-an-email" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(expect.arrayContaining([expect.stringContaining("email")]));
  });

  it("should return 400 when 'phone' is an invalid French number", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ ...validBody, phone: "+1 555 123 4567" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual(
      expect.arrayContaining([expect.stringContaining("telephone")])
    );
  });

  it("should return 400 when multiple fields are invalid", async () => {
    const { POST } = await importRoute();

    const response = await POST(createRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details.length).toBeGreaterThanOrEqual(3);
  });

  // ─── Successful booking ─────────────────────────────────────────────

  it("should return 201 with booking data on success", async () => {
    const { POST } = await importRoute();

    const response = await POST(createRequest(validBody));
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

    await POST(createRequest(validBody));

    expect(mockCreateBooking).toHaveBeenCalledWith({
      uid: "test-uuid-1234",
      title: "Consultation - Jean Dupont",
      startTime: new Date("2026-06-15T09:00:00Z"),
      endTime: new Date("2026-06-15T09:30:00Z"),
      eventTypeId: 42,
      description: null,
    });
  });

  it("should call createAttendee with correct parameters", async () => {
    const { POST } = await importRoute();

    await POST(createRequest(validBody));

    expect(mockCreateAttendee).toHaveBeenCalledWith({
      bookingId: 1,
      name: "Jean Dupont",
      email: "jean@example.com",
      phone: "+33612345678",
      timeZone: "Europe/Paris",
      locale: "fr",
    });
  });

  it("should accept valid French phone numbers", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ ...validBody, phone: "06 12 34 56 78" })
    );

    expect(response.status).toBe(201);
  });

  it("should accept phone with international prefix +33", async () => {
    const { POST } = await importRoute();

    const response = await POST(
      createRequest({ ...validBody, phone: "+33 6 12 34 56 78" })
    );

    expect(response.status).toBe(201);
  });

  it("should accept request without optional phone field", async () => {
    const { POST } = await importRoute();

    const { phone: _, ...bodyWithoutPhone } = validBody;
    const response = await POST(createRequest(bodyWithoutPhone));

    expect(response.status).toBe(201);
    expect(mockCreateAttendee).toHaveBeenCalledWith(
      expect.objectContaining({ phone: undefined })
    );
  });

  it("should use eventTypeId from body when provided", async () => {
    const { POST } = await importRoute();
    const eventType99 = { id: 99, title: "Suivi", slug: "suivi", length: 15, description: null };
    mockGetEventTypes.mockResolvedValueOnce([...mockEventTypes, eventType99]);
    mockCreateBooking.mockResolvedValueOnce({
      ...mockBookingResult,
      eventTypeId: 99,
      title: "Suivi - Jean Dupont",
      endTime: new Date("2026-06-15T09:15:00Z"),
    });

    const response = await POST(
      createRequest({ ...validBody, eventTypeId: 99 })
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

    const response = await POST(createRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("introuvable");
  });

  // ─── Database errors ───────────────────────────────────────────────

  it("should return 504 on database timeout", async () => {
    const { POST } = await importRoute();
    mockGetEventTypes.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.TIMEOUT])
    );

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(504);
  });

  it("should return 503 on database connection refused", async () => {
    const { POST } = await importRoute();
    mockGetEventTypes.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.CONNECTION_REFUSED])
    );

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(503);
  });

  it("should return 500 on unknown database error", async () => {
    const { POST } = await importRoute();
    mockGetEventTypes.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.UNKNOWN])
    );

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(500);
  });

  it("should return 500 for unexpected errors", async () => {
    const { POST } = await importRoute();
    mockGetEventTypes.mockRejectedValueOnce(new Error("Unexpected"));

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(500);
  });
});
