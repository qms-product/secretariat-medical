import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CalcomAvailabilityResult } from "../calcom-availability";

// Mock pg module
const mockQuery = vi.fn();
const mockPool = {
  query: mockQuery,
  end: vi.fn(),
};

vi.mock("pg", () => ({
  Pool: vi.fn(() => mockPool),
}));

async function importModule() {
  vi.resetModules();
  // Re-mock pg after resetModules
  vi.doMock("pg", () => ({
    Pool: vi.fn(() => mockPool),
  }));
  return await import("../calcom-availability");
}

describe("calcom-availability (IMP-35 / REQ-90)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CALCOM_DATABASE_URL =
      "postgresql://calcom:calcom@localhost:5432/calcom";
    process.env.CAL_COM_EVENT_TYPE_ID = "42";
  });

  afterEach(() => {
    delete process.env.CALCOM_DATABASE_URL;
    delete process.env.CAL_COM_EVENT_TYPE_ID;
  });

  describe("createPool", () => {
    it("should throw when CALCOM_DATABASE_URL is not configured", async () => {
      delete process.env.CALCOM_DATABASE_URL;
      const { createPool } = await importModule();
      expect(() => createPool()).toThrow("CALCOM_DATABASE_URL not configured");
    });

    it("should create a pool when CALCOM_DATABASE_URL is set", async () => {
      const { createPool } = await importModule();
      const pool = createPool();
      expect(pool).toBeDefined();
    });
  });

  describe("fetchAvailability", () => {
    it("should throw when CAL_COM_EVENT_TYPE_ID is not configured", async () => {
      delete process.env.CAL_COM_EVENT_TYPE_ID;
      const { fetchAvailability } = await importModule();

      await expect(fetchAvailability(mockPool as never)).rejects.toThrow(
        "CAL_COM_EVENT_TYPE_ID not configured"
      );
    });

    it("should query PostgreSQL with correct parameters", async () => {
      const { fetchAvailability } = await importModule();
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fetchAvailability(mockPool as never);

      expect(mockQuery).toHaveBeenCalledOnce();
      const [query, params] = mockQuery.mock.calls[0];
      expect(query).toContain("Booking");
      expect(query).toContain("eventTypeId");
      expect(params[0]).toBe(42);
      expect(typeof params[1]).toBe("string"); // startTime ISO
      expect(typeof params[2]).toBe("string"); // endTime ISO
    });

    it("should return formatted slots from database rows", async () => {
      const { fetchAvailability } = await importModule();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            start_time: "2026-06-20T09:00:00.000Z",
            end_time: "2026-06-20T09:30:00.000Z",
            title: "Consultation",
          },
          {
            start_time: "2026-06-20T14:00:00.000Z",
            end_time: "2026-06-20T14:30:00.000Z",
            title: "Suivi",
          },
        ],
      });

      const result = await fetchAvailability(mockPool as never);

      expect(result.slots).toHaveLength(2);
      expect(result.slots[0].date).toBe("2026-06-20");
      expect(result.slots[0].title).toBe("Consultation");
      expect(result.slots[1].title).toBe("Suivi");
      expect(result.fetchedAt).toBeTruthy();
    });

    it("should return empty slots array when no bookings found", async () => {
      const { fetchAvailability } = await importModule();
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fetchAvailability(mockPool as never);

      expect(result.slots).toHaveLength(0);
      expect(result.fetchedAt).toBeTruthy();
    });

    it("should use 14 days lookahead by default", async () => {
      const { fetchAvailability, AVAILABILITY_LOOKAHEAD_DAYS } =
        await importModule();
      expect(AVAILABILITY_LOOKAHEAD_DAYS).toBe(14);

      mockQuery.mockResolvedValueOnce({ rows: [] });
      await fetchAvailability(mockPool as never);

      const [, params] = mockQuery.mock.calls[0];
      const startDate = new Date(params[1]);
      const endDate = new Date(params[2]);
      const diffDays = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBe(14);
    });

    it("should accept custom lookahead days", async () => {
      const { fetchAvailability } = await importModule();
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fetchAvailability(mockPool as never, 7);

      const [, params] = mockQuery.mock.calls[0];
      const startDate = new Date(params[1]);
      const endDate = new Date(params[2]);
      const diffDays = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBe(7);
    });

    it("should update data on each call (not cached)", async () => {
      const { fetchAvailability } = await importModule();
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              start_time: "2026-06-20T09:00:00.000Z",
              end_time: "2026-06-20T09:30:00.000Z",
              title: "Consultation",
            },
          ],
        });

      const result1 = await fetchAvailability(mockPool as never);
      const result2 = await fetchAvailability(mockPool as never);

      expect(result1.slots).toHaveLength(0);
      expect(result2.slots).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe("formatAvailabilityForPrompt", () => {
    it("should format empty availability", async () => {
      const { formatAvailabilityForPrompt } = await importModule();
      const availability: CalcomAvailabilityResult = {
        slots: [],
        fetchedAt: "2026-06-17T10:00:00.000Z",
      };

      const result = formatAvailabilityForPrompt(availability);

      expect(result).toContain("DISPONIBILITES CAL.COM");
      expect(result).toContain("Aucun creneau reserve");
    });

    it("should format slots grouped by date", async () => {
      const { formatAvailabilityForPrompt } = await importModule();
      const availability: CalcomAvailabilityResult = {
        slots: [
          {
            date: "2026-06-20",
            startTime: "09:00",
            endTime: "09:30",
            title: "Consultation",
          },
          {
            date: "2026-06-20",
            startTime: "14:00",
            endTime: "14:30",
            title: "Suivi",
          },
          {
            date: "2026-06-21",
            startTime: "10:00",
            endTime: "10:30",
            title: "Consultation",
          },
        ],
        fetchedAt: "2026-06-17T10:00:00.000Z",
      };

      const result = formatAvailabilityForPrompt(availability);

      expect(result).toContain("DISPONIBILITES CAL.COM");
      expect(result).toContain("09:00 - 09:30 : Consultation");
      expect(result).toContain("14:00 - 14:30 : Suivi");
      expect(result).toContain("10:00 - 10:30 : Consultation");
    });

    it("should include fetch timestamp", async () => {
      const { formatAvailabilityForPrompt } = await importModule();
      const availability: CalcomAvailabilityResult = {
        slots: [],
        fetchedAt: "2026-06-17T10:00:00.000Z",
      };

      const result = formatAvailabilityForPrompt(availability);
      expect(result).toContain("mis a jour le");
    });
  });

  describe("buildSystemPrompt with availability (IMP-35)", () => {
    it("should include availability section when provided", async () => {
      const { buildSystemPrompt } = await import("../system-prompt");
      const availability: CalcomAvailabilityResult = {
        slots: [
          {
            date: "2026-06-20",
            startTime: "09:00",
            endTime: "09:30",
            title: "Consultation",
          },
        ],
        fetchedAt: "2026-06-17T10:00:00.000Z",
      };

      const prompt = buildSystemPrompt(availability);

      expect(prompt).toContain("DISPONIBILITES CAL.COM");
      expect(prompt).toContain("09:00 - 09:30 : Consultation");
    });

    it("should not include availability section when not provided", async () => {
      const { buildSystemPrompt } = await import("../system-prompt");

      const prompt = buildSystemPrompt();

      expect(prompt).not.toContain("DISPONIBILITES CAL.COM");
    });

    it("should still contain all existing prompt sections when availability is provided", async () => {
      const { buildSystemPrompt } = await import("../system-prompt");
      const availability: CalcomAvailabilityResult = {
        slots: [],
        fetchedAt: "2026-06-17T10:00:00.000Z",
      };

      const prompt = buildSystemPrompt(availability);

      expect(prompt).toContain("INTERDICTION ABSOLUE");
      expect(prompt).toContain("INFORMATIONS DU CABINET");
      expect(prompt).toContain("Cabinet Medical Fictif");
    });

    it("should propose only valid slots (from DB data, not hardcoded)", async () => {
      const { buildSystemPrompt } = await import("../system-prompt");
      const availability: CalcomAvailabilityResult = {
        slots: [
          {
            date: "2026-06-20",
            startTime: "09:00",
            endTime: "09:30",
            title: "Consultation Dr. Dupont",
          },
        ],
        fetchedAt: "2026-06-17T10:00:00.000Z",
      };

      const prompt = buildSystemPrompt(availability);

      // The real availability data should be present in the prompt
      expect(prompt).toContain("Consultation Dr. Dupont");
      expect(prompt).toContain("09:00 - 09:30");
      // Date is formatted as French locale label (e.g. "samedi 20 juin 2026")
      expect(prompt).toContain("20");
      expect(prompt).toContain("juin");
      expect(prompt).toContain("2026");
    });
  });

  describe("PostgreSQL connection security", () => {
    it("should require CALCOM_DATABASE_URL to be set", async () => {
      delete process.env.CALCOM_DATABASE_URL;
      const { createPool } = await importModule();
      expect(() => createPool()).toThrow("CALCOM_DATABASE_URL not configured");
    });

    it("should use connection string from environment variable only", async () => {
      const PoolSpy = vi.fn(() => mockPool);
      vi.resetModules();
      vi.doMock("pg", () => ({ Pool: PoolSpy }));
      const { createPool } = await import("../calcom-availability");
      createPool();
      expect(PoolSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString:
            "postgresql://calcom:calcom@localhost:5432/calcom",
        })
      );
    });

    it("should configure connection timeout", async () => {
      const PoolSpy = vi.fn(() => mockPool);
      vi.resetModules();
      vi.doMock("pg", () => ({ Pool: PoolSpy }));
      const { createPool } = await import("../calcom-availability");
      createPool();
      expect(PoolSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionTimeoutMillis: 10_000,
        })
      );
    });
  });
});
