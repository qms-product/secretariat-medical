import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

async function importModule() {
  vi.resetModules();
  return await import("../calcom");
}

describe("Cal.com service layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CAL_COM_API_KEY = "test-calcom-key";
    process.env.CAL_COM_BASE_URL = "http://localhost:3000";
    process.env.CAL_COM_EVENT_TYPE_ID = "42";
  });

  afterEach(() => {
    delete process.env.CAL_COM_API_KEY;
    delete process.env.CAL_COM_BASE_URL;
    delete process.env.CAL_COM_EVENT_TYPE_ID;
  });

  describe("getAvailability", () => {
    it("should throw when CAL_COM_API_KEY is not set", async () => {
      delete process.env.CAL_COM_API_KEY;
      const { getAvailability } = await importModule();

      await expect(
        getAvailability("2026-06-15T00:00:00Z", "2026-06-16T00:00:00Z")
      ).rejects.toThrow("CAL_COM_API_KEY not configured");
    });

    it("should throw when CAL_COM_EVENT_TYPE_ID is not set", async () => {
      delete process.env.CAL_COM_EVENT_TYPE_ID;
      const { getAvailability } = await importModule();

      await expect(
        getAvailability("2026-06-15T00:00:00Z", "2026-06-16T00:00:00Z")
      ).rejects.toThrow("CAL_COM_EVENT_TYPE_ID not configured");
    });

    it("should call Cal.com API with correct URL and headers", async () => {
      const { getAvailability } = await importModule();

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ slots: {} }), { status: 200 })
      );

      await getAvailability("2026-06-15T00:00:00Z", "2026-06-16T00:00:00Z");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/v2/slots/available");
      expect(url).toContain("startTime=2026-06-15T00%3A00%3A00Z");
      expect(url).toContain("endTime=2026-06-16T00%3A00%3A00Z");
      expect(url).toContain("eventTypeId=42");
      expect(options.headers.Authorization).toBe("Bearer test-calcom-key");
    });

    it("should return slots on success", async () => {
      const { getAvailability } = await importModule();
      const slotsData = {
        slots: {
          "2026-06-15": [{ time: "2026-06-15T09:00:00Z" }, { time: "2026-06-15T10:00:00Z" }],
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(slotsData), { status: 200 })
      );

      const result = await getAvailability("2026-06-15T00:00:00Z", "2026-06-16T00:00:00Z");
      expect(result.slots["2026-06-15"]).toHaveLength(2);
    });

    it("should throw CalcomApiError on non-OK response", async () => {
      const { getAvailability, CalcomApiError } = await importModule();

      mockFetch.mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500 })
      );

      await expect(
        getAvailability("2026-06-15T00:00:00Z", "2026-06-16T00:00:00Z")
      ).rejects.toBeInstanceOf(CalcomApiError);
    });

    it("should throw CalcomTimeoutError when fetch rejects with AbortError", async () => {
      const { getAvailability, CalcomTimeoutError } = await importModule();

      mockFetch.mockRejectedValueOnce(
        new DOMException("The operation was aborted.", "AbortError")
      );

      await expect(
        getAvailability("2026-06-15T00:00:00Z", "2026-06-16T00:00:00Z")
      ).rejects.toBeInstanceOf(CalcomTimeoutError);
    });
  });

  describe("createBooking", () => {
    it("should throw when CAL_COM_API_KEY is not set", async () => {
      delete process.env.CAL_COM_API_KEY;
      const { createBooking } = await importModule();

      await expect(
        createBooking({
          eventTypeId: 42,
          start: "2026-06-15T09:00:00Z",
          name: "Jean Dupont",
          email: "jean@example.com",
        })
      ).rejects.toThrow("CAL_COM_API_KEY not configured");
    });

    it("should call Cal.com API with correct body and headers", async () => {
      const { createBooking } = await importModule();

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1,
            uid: "abc-123",
            title: "Consultation",
            startTime: "2026-06-15T09:00:00Z",
            endTime: "2026-06-15T09:30:00Z",
          }),
          { status: 200 }
        )
      );

      await createBooking({
        eventTypeId: 42,
        start: "2026-06-15T09:00:00Z",
        name: "Jean Dupont",
        email: "jean@example.com",
        phone: "+33612345678",
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/v2/bookings");
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toBe("Bearer test-calcom-key");

      const body = JSON.parse(options.body);
      expect(body.eventTypeId).toBe(42);
      expect(body.start).toBe("2026-06-15T09:00:00Z");
      expect(body.attendee.name).toBe("Jean Dupont");
      expect(body.attendee.email).toBe("jean@example.com");
      expect(body.attendee.phoneNumber).toBe("+33612345678");
    });

    it("should return booking data on success", async () => {
      const { createBooking } = await importModule();
      const bookingData = {
        id: 1,
        uid: "abc-123",
        title: "Consultation",
        startTime: "2026-06-15T09:00:00Z",
        endTime: "2026-06-15T09:30:00Z",
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(bookingData), { status: 200 })
      );

      const result = await createBooking({
        eventTypeId: 42,
        start: "2026-06-15T09:00:00Z",
        name: "Jean Dupont",
        email: "jean@example.com",
      });

      expect(result.id).toBe(1);
      expect(result.uid).toBe("abc-123");
    });

    it("should throw CalcomApiError on non-OK response", async () => {
      const { createBooking, CalcomApiError } = await importModule();

      mockFetch.mockResolvedValueOnce(
        new Response("Conflict", { status: 409 })
      );

      await expect(
        createBooking({
          eventTypeId: 42,
          start: "2026-06-15T09:00:00Z",
          name: "Jean Dupont",
          email: "jean@example.com",
        })
      ).rejects.toBeInstanceOf(CalcomApiError);
    });
  });
});
