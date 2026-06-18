import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  CalcomDatabaseError,
  PG_ERRORS,
  PgErrorType,
} from "@/lib/calcom-db-errors";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetAvailabilities = vi.fn();
const mockGetBookings = vi.fn();

vi.mock("@/lib/calcom-service", () => ({
  CalcomService: vi.fn().mockImplementation(() => ({
    getAvailabilities: mockGetAvailabilities,
    getBookings: mockGetBookings,
  })),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

async function importRoute() {
  vi.resetModules();
  vi.doMock("@/lib/calcom-service", () => ({
    CalcomService: vi.fn().mockImplementation(() => ({
      getAvailabilities: mockGetAvailabilities,
      getBookings: mockGetBookings,
    })),
  }));
  return await import("../route");
}

function createRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3001/api/calcom/availability");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

const mockAvailabilities = [
  {
    id: 1,
    scheduleId: 1,
    days: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "17:00",
  },
];

const mockBookings = [
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
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/calcom/availability (PostgreSQL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CAL_COM_EVENT_TYPE_ID = "42";
    mockGetAvailabilities.mockResolvedValue(mockAvailabilities);
    mockGetBookings.mockResolvedValue(mockBookings);
  });

  afterEach(() => {
    delete process.env.CAL_COM_EVENT_TYPE_ID;
  });

  // ─── Config errors ──────────────────────────────────────────────────

  it("should return 500 when CAL_COM_EVENT_TYPE_ID is not configured", async () => {
    delete process.env.CAL_COM_EVENT_TYPE_ID;
    const { GET } = await importRoute();

    const response = await GET(
      createRequest({
        startTime: "2026-06-15T00:00:00Z",
        endTime: "2026-06-16T00:00:00Z",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("CAL_COM_EVENT_TYPE_ID not configured");
  });

  // ─── Validation ─────────────────────────────────────────────────────

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

    const response = await GET(
      createRequest({ startTime: "not-a-date", endTime: "2026-06-16" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("ISO 8601");
  });

  // ─── Successful response ──────────────────────────────────────────

  it("should return availabilities and bookings on success", async () => {
    const { GET } = await importRoute();

    const response = await GET(
      createRequest({
        startTime: "2026-06-15T00:00:00Z",
        endTime: "2026-06-16T00:00:00Z",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.availabilities).toHaveLength(1);
    expect(body.availabilities[0].days).toEqual([1, 2, 3, 4, 5]);
    expect(body.bookings).toHaveLength(1);
    expect(body.bookings[0].startTime).toBe("2026-06-15T09:00:00.000Z");
  });

  it("should pass scheduleId filter when provided", async () => {
    const { GET } = await importRoute();

    await GET(
      createRequest({
        startTime: "2026-06-15T00:00:00Z",
        endTime: "2026-06-16T00:00:00Z",
        scheduleId: "5",
      })
    );

    expect(mockGetAvailabilities).toHaveBeenCalledWith(5);
  });

  it("should pass date range and eventTypeId to getBookings", async () => {
    const { GET } = await importRoute();

    await GET(
      createRequest({
        startTime: "2026-06-15T00:00:00Z",
        endTime: "2026-06-16T00:00:00Z",
      })
    );

    expect(mockGetBookings).toHaveBeenCalledWith({
      eventTypeId: 42,
      startAfter: new Date("2026-06-15T00:00:00Z"),
      startBefore: new Date("2026-06-16T00:00:00Z"),
    });
  });

  // ─── Database errors ──────────────────────────────────────────────

  it("should return 504 on database timeout", async () => {
    const { GET } = await importRoute();
    mockGetAvailabilities.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.TIMEOUT])
    );

    const response = await GET(
      createRequest({
        startTime: "2026-06-15T00:00:00Z",
        endTime: "2026-06-16T00:00:00Z",
      })
    );

    expect(response.status).toBe(504);
  });

  it("should return 503 on database connection refused", async () => {
    const { GET } = await importRoute();
    mockGetAvailabilities.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.CONNECTION_REFUSED])
    );

    const response = await GET(
      createRequest({
        startTime: "2026-06-15T00:00:00Z",
        endTime: "2026-06-16T00:00:00Z",
      })
    );

    expect(response.status).toBe(503);
  });

  it("should return 500 on unknown database error", async () => {
    const { GET } = await importRoute();
    mockGetAvailabilities.mockRejectedValueOnce(
      new CalcomDatabaseError(PG_ERRORS[PgErrorType.UNKNOWN])
    );

    const response = await GET(
      createRequest({
        startTime: "2026-06-15T00:00:00Z",
        endTime: "2026-06-16T00:00:00Z",
      })
    );

    expect(response.status).toBe(500);
  });

  it("should return 500 for unexpected errors", async () => {
    const { GET } = await importRoute();
    mockGetAvailabilities.mockRejectedValueOnce(new Error("Unexpected"));

    const response = await GET(
      createRequest({
        startTime: "2026-06-15T00:00:00Z",
        endTime: "2026-06-16T00:00:00Z",
      })
    );

    expect(response.status).toBe(500);
  });
});
