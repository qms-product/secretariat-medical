import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the calcom service
vi.mock("@/lib/calcom", () => ({
  getAvailability: vi.fn(),
  CalcomApiError: class CalcomApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: string
    ) {
      super(`Cal.com API error [${status}]: ${body}`);
      this.name = "CalcomApiError";
    }
  },
  CalcomTimeoutError: class CalcomTimeoutError extends Error {
    constructor() {
      super("Cal.com API request timed out");
      this.name = "CalcomTimeoutError";
    }
  },
}));

async function importRoute() {
  vi.resetModules();
  // Re-mock after resetModules
  vi.doMock("@/lib/calcom", () => ({
    getAvailability: mockGetAvailability,
    CalcomApiError: MockCalcomApiError,
    CalcomTimeoutError: MockCalcomTimeoutError,
  }));
  return await import("../route");
}

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

const mockGetAvailability = vi.fn();

function createRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3001/api/calcom/availability");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

describe("GET /api/calcom/availability", () => {
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
    const { GET } = await importRoute();

    const response = await GET(createRequest({ startTime: "2026-06-15", endTime: "2026-06-16" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("CAL_COM_API_KEY not configured");
  });

  it("should return 500 when CAL_COM_EVENT_TYPE_ID is not configured", async () => {
    delete process.env.CAL_COM_EVENT_TYPE_ID;
    const { GET } = await importRoute();

    const response = await GET(createRequest({ startTime: "2026-06-15", endTime: "2026-06-16" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("CAL_COM_EVENT_TYPE_ID not configured");
  });

  // AC: Validation des données avant envoi à Cal.com
  it("should return 400 when startTime is missing", async () => {
    const { GET } = await importRoute();

    const response = await GET(createRequest({ endTime: "2026-06-16" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("startTime");
  });

  it("should return 400 when endTime is missing", async () => {
    const { GET } = await importRoute();

    const response = await GET(createRequest({ startTime: "2026-06-15" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("endTime");
  });

  it("should return 400 for invalid date format", async () => {
    const { GET } = await importRoute();

    const response = await GET(createRequest({ startTime: "not-a-date", endTime: "2026-06-16" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("ISO 8601");
  });

  // AC: Route GET /api/calcom/availability retourne créneaux JSON
  it("should return slots on success", async () => {
    const { GET } = await importRoute();
    const slotsData = {
      slots: {
        "2026-06-15": [{ time: "2026-06-15T09:00:00Z" }],
      },
    };
    mockGetAvailability.mockResolvedValueOnce(slotsData);

    const response = await GET(
      createRequest({ startTime: "2026-06-15T00:00:00Z", endTime: "2026-06-16T00:00:00Z" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.slots["2026-06-15"]).toHaveLength(1);
  });

  // AC: Gestion erreurs avec codes HTTP appropriés
  it("should return 504 on Cal.com timeout", async () => {
    const { GET } = await importRoute();
    mockGetAvailability.mockRejectedValueOnce(new MockCalcomTimeoutError());

    const response = await GET(
      createRequest({ startTime: "2026-06-15T00:00:00Z", endTime: "2026-06-16T00:00:00Z" })
    );
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.error).toContain("Cal.com");
  });

  it("should return 429 when Cal.com returns rate limit", async () => {
    const { GET } = await importRoute();
    mockGetAvailability.mockRejectedValueOnce(new MockCalcomApiError(429, "Rate limited"));

    const response = await GET(
      createRequest({ startTime: "2026-06-15T00:00:00Z", endTime: "2026-06-16T00:00:00Z" })
    );

    expect(response.status).toBe(429);
  });

  it("should return 503 when Cal.com is unavailable", async () => {
    const { GET } = await importRoute();
    mockGetAvailability.mockRejectedValueOnce(new MockCalcomApiError(503, "Service Unavailable"));

    const response = await GET(
      createRequest({ startTime: "2026-06-15T00:00:00Z", endTime: "2026-06-16T00:00:00Z" })
    );

    expect(response.status).toBe(503);
  });

  it("should return 502 for other Cal.com errors", async () => {
    const { GET } = await importRoute();
    mockGetAvailability.mockRejectedValueOnce(new MockCalcomApiError(400, "Bad Request"));

    const response = await GET(
      createRequest({ startTime: "2026-06-15T00:00:00Z", endTime: "2026-06-16T00:00:00Z" })
    );

    expect(response.status).toBe(502);
  });

  it("should return 500 for unexpected errors", async () => {
    const { GET } = await importRoute();
    mockGetAvailability.mockRejectedValueOnce(new Error("Unexpected"));

    const response = await GET(
      createRequest({ startTime: "2026-06-15T00:00:00Z", endTime: "2026-06-16T00:00:00Z" })
    );

    expect(response.status).toBe(500);
  });
});
