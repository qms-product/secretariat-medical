import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CalcomService } from "../calcom-service";

// Mock pg module
const mockQuery = vi.fn();
const mockPool = {
  query: mockQuery,
  end: vi.fn(),
};

vi.mock("pg", () => ({
  Pool: vi.fn(() => mockPool),
}));

// Mock calcom-availability to provide the mock pool
vi.mock("../calcom-availability", () => ({
  getPool: vi.fn(() => mockPool),
  createPool: vi.fn(() => mockPool),
  resetPool: vi.fn(),
}));

async function createService(): Promise<CalcomService> {
  const { CalcomService } = await import("../calcom-service");
  return new CalcomService(mockPool as never);
}

describe("CalcomService (IMP-20 / ADR-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CALCOM_DATABASE_URL =
      "postgresql://calcom:calcom@localhost:5432/calcom";
    process.env.CAL_COM_EVENT_TYPE_ID = "1";
  });

  afterEach(() => {
    delete process.env.CALCOM_DATABASE_URL;
    delete process.env.CAL_COM_EVENT_TYPE_ID;
  });

  // ─── REQ-73: PostgreSQL connection ────────────────────────────────

  describe("PostgreSQL connection (REQ-73)", () => {
    it("should accept an injected pool", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getEventTypes();
      expect(mockQuery).toHaveBeenCalledOnce();
    });

    it("should use shared pool when none is provided", async () => {
      const { CalcomService } = await import("../calcom-service");
      const service = new CalcomService();
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getEventTypes();
      expect(mockQuery).toHaveBeenCalledOnce();
    });

    it("should propagate connection errors as CalcomDatabaseError", async () => {
      const service = await createService();
      const connError = new Error("connection refused");
      (connError as NodeJS.ErrnoException).code = "ECONNREFUSED";
      mockQuery.mockRejectedValueOnce(connError);

      const { CalcomDatabaseError } = await import("../calcom-db-errors");
      await expect(service.getEventTypes()).rejects.toThrow(
        CalcomDatabaseError
      );
    });

    it("should propagate timeout errors as CalcomDatabaseError", async () => {
      const service = await createService();
      const timeoutError = new Error("timeout");
      (timeoutError as NodeJS.ErrnoException).code = "ETIMEDOUT";
      mockQuery.mockRejectedValueOnce(timeoutError);

      const { CalcomDatabaseError } = await import("../calcom-db-errors");
      await expect(service.getEventTypes()).rejects.toThrow(
        CalcomDatabaseError
      );
    });
  });

  // ─── REQ-102: EventType SELECT ────────────────────────────────────

  describe("getEventTypes (REQ-102)", () => {
    it("should query EventType table for active event types", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: "Consultation",
            slug: "consultation",
            length: 30,
            description: "Consultation médicale",
          },
          {
            id: 2,
            title: "Suivi",
            slug: "suivi",
            length: 15,
            description: null,
          },
        ],
      });

      const result = await service.getEventTypes();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        title: "Consultation",
        slug: "consultation",
        length: 30,
        description: "Consultation médicale",
      });
      expect(result[1].id).toBe(2);
      expect(result[1].description).toBeNull();
    });

    it("should query with hidden=false filter", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getEventTypes();

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain("EventType");
      expect(query).toContain("hidden = false");
    });

    it("should return empty array when no event types exist", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await service.getEventTypes();
      expect(result).toEqual([]);
    });
  });

  // ─── REQ-103: Availability SELECT ─────────────────────────────────

  describe("getAvailabilities (REQ-103)", () => {
    it("should return availability entries with start/end times", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            scheduleId: 10,
            days: [1, 2, 3, 4, 5],
            startTime: "09:00:00",
            endTime: "17:00:00",
          },
        ],
      });

      const result = await service.getAvailabilities();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        scheduleId: 10,
        days: [1, 2, 3, 4, 5],
        startTime: "09:00:00",
        endTime: "17:00:00",
      });
    });

    it("should filter by scheduleId when provided", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getAvailabilities(10);

      const [query, params] = mockQuery.mock.calls[0];
      expect(query).toContain("Availability");
      expect(query).toContain("scheduleId");
      expect(params).toEqual([10]);
    });

    it("should return all availabilities when no filter is provided", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getAvailabilities();

      const [query, params] = mockQuery.mock.calls[0];
      expect(query).toContain("Availability");
      expect(query).not.toContain("WHERE");
      expect(params).toEqual([]);
    });
  });

  // ─── REQ-104: Booking SELECT ──────────────────────────────────────

  describe("getBookings (REQ-104)", () => {
    it("should return bookings with date and time", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            uid: "abc-123",
            title: "Consultation",
            startTime: "2026-06-20T09:00:00.000Z",
            endTime: "2026-06-20T09:30:00.000Z",
            status: "ACCEPTED",
            eventTypeId: 1,
            description: null,
          },
        ],
      });

      const result = await service.getBookings();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].uid).toBe("abc-123");
      expect(result[0].startTime).toBeInstanceOf(Date);
      expect(result[0].endTime).toBeInstanceOf(Date);
      expect(result[0].status).toBe("ACCEPTED");
    });

    it("should filter by eventTypeId", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getBookings({ eventTypeId: 42 });

      const [query, params] = mockQuery.mock.calls[0];
      expect(query).toContain("eventTypeId");
      expect(params).toContain(42);
    });

    it("should filter by date range", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const startAfter = new Date("2026-06-20T00:00:00Z");
      const startBefore = new Date("2026-06-27T00:00:00Z");
      await service.getBookings({ startAfter, startBefore });

      const [query, params] = mockQuery.mock.calls[0];
      expect(query).toContain("startTime");
      expect(params).toHaveLength(2);
    });

    it("should combine multiple filters", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.getBookings({
        eventTypeId: 1,
        startAfter: new Date("2026-06-20T00:00:00Z"),
        startBefore: new Date("2026-06-27T00:00:00Z"),
      });

      const [query, params] = mockQuery.mock.calls[0];
      expect(query).toContain("eventTypeId");
      expect(query).toContain("startTime");
      expect(params).toHaveLength(3);
    });

    it("should return all bookings when no filters are provided", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getBookings();

      const [query, params] = mockQuery.mock.calls[0];
      expect(query).toContain("Booking");
      expect(query).not.toContain("WHERE");
      expect(params).toEqual([]);
    });
  });

  // ─── REQ-105: Schedule SELECT ─────────────────────────────────────

  describe("getSchedules (REQ-105)", () => {
    it("should return schedules with days and hours", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            userId: 100,
            name: "Horaires de travail",
            timeZone: "Europe/Paris",
          },
        ],
      });

      const result = await service.getSchedules();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        userId: 100,
        name: "Horaires de travail",
        timeZone: "Europe/Paris",
      });
    });

    it("should filter by userId when provided", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getSchedules(100);

      const [query, params] = mockQuery.mock.calls[0];
      expect(query).toContain("Schedule");
      expect(query).toContain("userId");
      expect(params).toEqual([100]);
    });

    it("should return all schedules when no filter is provided", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await service.getSchedules();

      const [query, params] = mockQuery.mock.calls[0];
      expect(query).not.toContain("WHERE");
      expect(params).toEqual([]);
    });
  });

  // ─── REQ-106: Booking INSERT ──────────────────────────────────────

  describe("createBooking (REQ-106)", () => {
    it("should insert a new booking with date, time, and event type", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 42,
            uid: "new-uid-123",
            title: "Consultation",
            startTime: "2026-06-20T09:00:00.000Z",
            endTime: "2026-06-20T09:30:00.000Z",
            status: "ACCEPTED",
            eventTypeId: 1,
            description: null,
          },
        ],
      });

      const result = await service.createBooking({
        uid: "new-uid-123",
        title: "Consultation",
        startTime: new Date("2026-06-20T09:00:00.000Z"),
        endTime: new Date("2026-06-20T09:30:00.000Z"),
        eventTypeId: 1,
      });

      expect(result.id).toBe(42);
      expect(result.uid).toBe("new-uid-123");
      expect(result.status).toBe("ACCEPTED");
      expect(result.startTime).toBeInstanceOf(Date);

      const [query, params] = mockQuery.mock.calls[0];
      expect(query).toContain("INSERT INTO");
      expect(query).toContain('"Booking"');
      expect(query).toContain("RETURNING");
      expect(params).toContain("new-uid-123");
      expect(params).toContain(1); // eventTypeId
    });

    it("should set status to ACCEPTED by default", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            uid: "uid",
            title: "Test",
            startTime: "2026-06-20T09:00:00.000Z",
            endTime: "2026-06-20T09:30:00.000Z",
            status: "ACCEPTED",
            eventTypeId: 1,
            description: null,
          },
        ],
      });

      await service.createBooking({
        uid: "uid",
        title: "Test",
        startTime: new Date("2026-06-20T09:00:00Z"),
        endTime: new Date("2026-06-20T09:30:00Z"),
        eventTypeId: 1,
      });

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain("'ACCEPTED'");
    });

    it("should handle optional description", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            uid: "uid",
            title: "Test",
            startTime: "2026-06-20T09:00:00.000Z",
            endTime: "2026-06-20T09:30:00.000Z",
            status: "ACCEPTED",
            eventTypeId: 1,
            description: "Note de consultation",
          },
        ],
      });

      const result = await service.createBooking({
        uid: "uid",
        title: "Test",
        startTime: new Date("2026-06-20T09:00:00Z"),
        endTime: new Date("2026-06-20T09:30:00Z"),
        eventTypeId: 1,
        description: "Note de consultation",
      });

      expect(result.description).toBe("Note de consultation");
      const params = mockQuery.mock.calls[0][1];
      expect(params).toContain("Note de consultation");
    });
  });

  // ─── REQ-107: Attendee INSERT ─────────────────────────────────────

  describe("createAttendee (REQ-107)", () => {
    it("should insert an attendee with name, email, and phone", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            bookingId: 42,
            name: "Jean Dupont",
            email: "jean.dupont@example.com",
            phone: "+33612345678",
            timeZone: "Europe/Paris",
            locale: "fr",
          },
        ],
      });

      const result = await service.createAttendee({
        bookingId: 42,
        name: "Jean Dupont",
        email: "jean.dupont@example.com",
        phone: "+33612345678",
      });

      expect(result.id).toBe(10);
      expect(result.bookingId).toBe(42);
      expect(result.name).toBe("Jean Dupont");
      expect(result.email).toBe("jean.dupont@example.com");
      expect(result.phone).toBe("+33612345678");
      expect(result.timeZone).toBe("Europe/Paris");
      expect(result.locale).toBe("fr");

      const [query, params] = mockQuery.mock.calls[0];
      expect(query).toContain("INSERT INTO");
      expect(query).toContain('"Attendee"');
      expect(query).toContain("RETURNING");
      expect(params).toContain(42); // bookingId
      expect(params).toContain("Jean Dupont");
      expect(params).toContain("jean.dupont@example.com");
      expect(params).toContain("+33612345678");
    });

    it("should default timeZone to Europe/Paris", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            bookingId: 1,
            name: "Test",
            email: "test@example.com",
            phone: null,
            timeZone: "Europe/Paris",
            locale: "fr",
          },
        ],
      });

      await service.createAttendee({
        bookingId: 1,
        name: "Test",
        email: "test@example.com",
      });

      const params = mockQuery.mock.calls[0][1];
      expect(params).toContain("Europe/Paris");
    });

    it("should default locale to fr", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            bookingId: 1,
            name: "Test",
            email: "test@example.com",
            phone: null,
            timeZone: "Europe/Paris",
            locale: "fr",
          },
        ],
      });

      await service.createAttendee({
        bookingId: 1,
        name: "Test",
        email: "test@example.com",
      });

      const params = mockQuery.mock.calls[0][1];
      expect(params).toContain("fr");
    });

    it("should handle null phone", async () => {
      const service = await createService();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            bookingId: 1,
            name: "Test",
            email: "test@example.com",
            phone: null,
            timeZone: "Europe/Paris",
            locale: "fr",
          },
        ],
      });

      const result = await service.createAttendee({
        bookingId: 1,
        name: "Test",
        email: "test@example.com",
      });

      expect(result.phone).toBeNull();
      const params = mockQuery.mock.calls[0][1];
      expect(params).toContain(null);
    });
  });

  // ─── Error handling ───────────────────────────────────────────────

  describe("SQL error handling", () => {
    it("should wrap SQL errors in CalcomDatabaseError for all methods", async () => {
      const service = await createService();
      const { CalcomDatabaseError } = await import("../calcom-db-errors");
      const sqlError = new Error("relation does not exist");

      const methods = [
        () => service.getEventTypes(),
        () => service.getAvailabilities(),
        () => service.getBookings(),
        () => service.getSchedules(),
        () =>
          service.createBooking({
            uid: "uid",
            title: "t",
            startTime: new Date(),
            endTime: new Date(),
            eventTypeId: 1,
          }),
        () =>
          service.createAttendee({
            bookingId: 1,
            name: "n",
            email: "e@e.com",
          }),
      ];

      for (const method of methods) {
        mockQuery.mockRejectedValueOnce(sqlError);
        await expect(method()).rejects.toThrow(CalcomDatabaseError);
      }
    });
  });

  // ─── Security: credentials not in source ──────────────────────────

  describe("Credentials security", () => {
    it("should not contain hardcoded credentials in service module", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const serviceSource = fs.readFileSync(
        path.resolve(__dirname, "../calcom-service.ts"),
        "utf-8"
      );

      expect(serviceSource).not.toContain("calcom:calcom");
      expect(serviceSource).not.toContain("localhost:5432");
      expect(serviceSource).not.toContain("postgresql://");
    });
  });
});
