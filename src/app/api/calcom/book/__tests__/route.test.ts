import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

class MockCalcomApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Cal.com API error [${status}]: ${body}`);
    this.name = "CalcomApiError";
  }
}

class MockCalcomTimeoutError extends Error {
  constructor() {
    super("Cal.com API request timed out");
    this.name = "CalcomTimeoutError";
  }
}

const mockCreateBooking = vi.fn();

async function importRoute() {
  vi.resetModules();
  vi.doMock("@/lib/calcom", () => ({
    createBooking: mockCreateBooking,
    CalcomApiError: MockCalcomApiError,
    CalcomTimeoutError: MockCalcomTimeoutError,
  }));
  return await import("../route");
}

function createRequest(body: unknown): NextRequest {
  const request = new NextRequest("http://localhost:3001/api/calcom/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return request;
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

describe("POST /api/calcom/book", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CAL_COM_API_KEY = "test-calcom-key";
    process.env.CAL_COM_EVENT_TYPE_ID = "42";
  });

  afterEach(() => {
    delete process.env.CAL_COM_API_KEY;
    delete process.env.CAL_COM_EVENT_TYPE_ID;
  });

  // AC: Utilisation exclusive de la clé API serveur
  it("should return 500 when CAL_COM_API_KEY is not configured", async () => {
    delete process.env.CAL_COM_API_KEY;
    const { POST } = await importRoute();

    const response = await POST(createRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("CAL_COM_API_KEY not configured");
  });

  it("should return 500 when CAL_COM_EVENT_TYPE_ID is not configured", async () => {
    delete process.env.CAL_COM_EVENT_TYPE_ID;
    const { POST } = await importRoute();

    const response = await POST(createRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("CAL_COM_EVENT_TYPE_ID not configured");
  });

  it("should return 400 for invalid JSON body", async () => {
    const { POST } = await importRoute();

    const response = await POST(createInvalidJsonRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("JSON");
  });

  // AC: Validation des données avant envoi à Cal.com
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

  it("should return 400 when multiple fields are invalid", async () => {
    const { POST } = await importRoute();

    const response = await POST(createRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details.length).toBeGreaterThanOrEqual(3);
  });

  // AC: Route POST /api/calcom/book accepte données patient et crée booking
  it("should return 201 with booking data on success", async () => {
    const { POST } = await importRoute();
    const bookingData = {
      id: 1,
      uid: "abc-123",
      title: "Consultation",
      startTime: "2026-06-15T09:00:00Z",
      endTime: "2026-06-15T09:30:00Z",
    };
    mockCreateBooking.mockResolvedValueOnce(bookingData);

    const response = await POST(createRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe(1);
    expect(body.uid).toBe("abc-123");
  });

  it("should pass correct data to createBooking service", async () => {
    const { POST } = await importRoute();
    mockCreateBooking.mockResolvedValueOnce({ id: 1, uid: "abc", title: "", startTime: "", endTime: "" });

    await POST(createRequest(validBody));

    expect(mockCreateBooking).toHaveBeenCalledWith({
      eventTypeId: 42,
      start: "2026-06-15T09:00:00Z",
      name: "Jean Dupont",
      email: "jean@example.com",
      phone: "+33612345678",
    });
  });

  it("should accept request without optional phone field", async () => {
    const { POST } = await importRoute();
    mockCreateBooking.mockResolvedValueOnce({ id: 1, uid: "abc", title: "", startTime: "", endTime: "" });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { phone, ...bodyWithoutPhone } = validBody;
    const response = await POST(createRequest(bodyWithoutPhone));

    expect(response.status).toBe(201);
  });

  // AC: Gestion erreurs avec codes HTTP appropriés
  it("should return 504 on Cal.com timeout", async () => {
    const { POST } = await importRoute();
    mockCreateBooking.mockRejectedValueOnce(new MockCalcomTimeoutError());

    const response = await POST(createRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.error).toContain("Cal.com");
  });

  it("should return 409 when slot is no longer available", async () => {
    const { POST } = await importRoute();
    mockCreateBooking.mockRejectedValueOnce(new MockCalcomApiError(409, "Conflict"));

    const response = await POST(createRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("disponible");
  });

  it("should return 429 on rate limit", async () => {
    const { POST } = await importRoute();
    mockCreateBooking.mockRejectedValueOnce(new MockCalcomApiError(429, "Rate limited"));

    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(429);
  });

  it("should return 503 when Cal.com is unavailable", async () => {
    const { POST } = await importRoute();
    mockCreateBooking.mockRejectedValueOnce(new MockCalcomApiError(503, "Service Unavailable"));

    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(503);
  });

  it("should return 502 for other Cal.com errors", async () => {
    const { POST } = await importRoute();
    mockCreateBooking.mockRejectedValueOnce(new MockCalcomApiError(400, "Bad Request"));

    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(502);
  });

  it("should return 500 for unexpected errors", async () => {
    const { POST } = await importRoute();
    mockCreateBooking.mockRejectedValueOnce(new Error("Unexpected"));

    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(500);
  });
});
