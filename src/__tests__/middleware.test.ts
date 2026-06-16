import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { resetBookingRateLimiter } from "@/lib/rate-limiter";

async function importMiddleware() {
  vi.resetModules();
  return await import("../middleware");
}

function createRequest(
  path: string,
  ip: string = "192.168.1.1"
): NextRequest {
  const url = `http://localhost:3001${path}`;
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("Rate limiting middleware (IMP-33)", () => {
  beforeEach(() => {
    resetBookingRateLimiter();
  });

  afterEach(() => {
    resetBookingRateLimiter();
  });

  // AC: Middleware appliqué aux routes API de booking
  it("should be configured to match calcom booking routes", async () => {
    const { config } = await importMiddleware();
    expect(config.matcher).toContain("/api/calcom/book");
    expect(config.matcher).toContain("/api/calcom/availability");
  });

  // AC: Réponse HTTP 429 avec headers Rate-Limit appropriés
  it("should allow requests within the limit and set rate limit headers", async () => {
    const { middleware } = await importMiddleware();
    const request = createRequest("/api/calcom/book");

    const response = middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Remaining")).toBeTruthy();
    expect(response.headers.get("X-RateLimit-Reset")).toBeTruthy();
    expect(response.headers.get("X-RateLimit-Limit")).toBeTruthy();
  });

  // AC: Blocage temporaire des IP dépassant les limites + HTTP 429
  it("should return 429 when rate limit is exceeded", async () => {
    const { middleware } = await importMiddleware();
    const ip = "10.0.0.99";

    // Exhaust the default limit (20 requests)
    for (let i = 0; i < 20; i++) {
      const req = createRequest("/api/calcom/book", ip);
      const res = middleware(req);
      expect(res.status).toBe(200);
    }

    // 21st request should be blocked
    const blockedReq = createRequest("/api/calcom/book", ip);
    const blockedRes = middleware(blockedReq);

    expect(blockedRes.status).toBe(429);

    const body = await blockedRes.json();
    expect(body.error).toContain("Trop de requêtes");
  });

  it("should include Retry-After header in 429 response", async () => {
    const { middleware } = await importMiddleware();
    const ip = "10.0.0.100";

    for (let i = 0; i < 20; i++) {
      middleware(createRequest("/api/calcom/book", ip));
    }

    const blockedRes = middleware(createRequest("/api/calcom/book", ip));
    expect(blockedRes.status).toBe(429);

    const retryAfter = blockedRes.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(parseInt(retryAfter!, 10)).toBeGreaterThan(0);
  });

  it("should include X-RateLimit-Remaining as 0 in 429 response", async () => {
    const { middleware } = await importMiddleware();
    const ip = "10.0.0.101";

    for (let i = 0; i < 20; i++) {
      middleware(createRequest("/api/calcom/book", ip));
    }

    const blockedRes = middleware(createRequest("/api/calcom/book", ip));
    expect(blockedRes.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  // AC: Different IPs tracked independently
  it("should track different IPs independently", async () => {
    const { middleware } = await importMiddleware();

    // Exhaust limit for IP A
    for (let i = 0; i < 20; i++) {
      middleware(createRequest("/api/calcom/book", "10.0.0.1"));
    }

    const blockedA = middleware(createRequest("/api/calcom/book", "10.0.0.1"));
    expect(blockedA.status).toBe(429);

    // IP B should still be allowed
    const allowedB = middleware(createRequest("/api/calcom/book", "10.0.0.2"));
    expect(allowedB.status).toBe(200);
  });

  it("should extract IP from x-forwarded-for header", async () => {
    const { middleware } = await importMiddleware();

    const request = new NextRequest("http://localhost:3001/api/calcom/book", {
      method: "POST",
      headers: {
        "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178",
      },
    });

    const response = middleware(request);
    expect(response.status).toBe(200);
  });

  it("should extract IP from x-real-ip header when x-forwarded-for is absent", async () => {
    const { middleware } = await importMiddleware();

    const request = new NextRequest("http://localhost:3001/api/calcom/book", {
      method: "POST",
      headers: {
        "x-real-ip": "203.0.113.75",
      },
    });

    const response = middleware(request);
    expect(response.status).toBe(200);
  });
});
