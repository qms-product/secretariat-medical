import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the secure-logger module so getSecureLogger returns a logger backed by real console
vi.mock("../secure-logger", () => ({
  getSecureLogger: () => ({
    debug: (...args: unknown[]) => console.log(...args),
    info: (...args: unknown[]) => console.log(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
  }),
  _resetSecureLogger: () => {},
}));

import {
  RateLimiter,
  loadRateLimitConfig,
  getBookingRateLimiter,
  resetBookingRateLimiter,
} from "../rate-limiter";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // AC: Limite configurable de requêtes par IP par fenêtre de temps
  it("should allow requests within the limit", () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000, blockDurationMs: 300_000 });

    const r1 = limiter.check("1.2.3.4");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.check("1.2.3.4");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check("1.2.3.4");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  // AC: Blocage temporaire des IP dépassant les limites
  it("should block IP after exceeding the limit", () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60_000, blockDurationMs: 300_000 });

    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");
    const r3 = limiter.check("1.2.3.4");

    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfterMs).toBe(300_000);
  });

  it("should unblock IP after block duration expires", () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000, blockDurationMs: 10_000 });

    limiter.check("1.2.3.4");
    const blocked = limiter.check("1.2.3.4");
    expect(blocked.allowed).toBe(false);

    // Advance past block duration
    vi.advanceTimersByTime(10_001);

    const unblocked = limiter.check("1.2.3.4");
    expect(unblocked.allowed).toBe(true);
    expect(unblocked.remaining).toBe(0); // just used 1 of 1
  });

  it("should track different IPs independently", () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000, blockDurationMs: 300_000 });

    limiter.check("1.1.1.1");
    const blocked = limiter.check("1.1.1.1");
    expect(blocked.allowed).toBe(false);

    const other = limiter.check("2.2.2.2");
    expect(other.allowed).toBe(true);
  });

  it("should reset window after time passes", () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 10_000, blockDurationMs: 5_000 });

    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");

    // Exceed limit — gets blocked
    const blocked = limiter.check("1.2.3.4");
    expect(blocked.allowed).toBe(false);

    // Advance past block duration
    vi.advanceTimersByTime(5_001);

    // After block expires, window is reset
    const r = limiter.check("1.2.3.4");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(1);
  });

  // AC: Logging des tentatives d'abus avec détails IP et timestamp
  it("should log when limit is exceeded", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000, blockDurationMs: 300_000 });

    limiter.check("10.0.0.1");
    limiter.check("10.0.0.1"); // exceeds

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[rate-limit]")
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("10.0.0.1")
    );

    consoleSpy.mockRestore();
  });

  it("should log when a blocked IP retries", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000, blockDurationMs: 300_000 });

    limiter.check("10.0.0.1");
    limiter.check("10.0.0.1"); // exceeds → block
    consoleSpy.mockClear();

    limiter.check("10.0.0.1"); // retry while blocked

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("10.0.0.1")
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[rate-limit]")
    );

    consoleSpy.mockRestore();
  });

  // AC: Réponse HTTP 429 avec headers Rate-Limit appropriés
  it("should return resetAt timestamp for rate limit headers", () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000, blockDurationMs: 300_000 });

    limiter.check("1.2.3.4");
    const result = limiter.check("1.2.3.4");

    expect(result.allowed).toBe(false);
    expect(result.resetAt).toBeGreaterThan(Date.now());
    expect(result.retryAfterMs).toBe(300_000);
  });

  it("should cleanup expired entries", () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1_000, blockDurationMs: 1_000 });

    limiter.check("1.1.1.1");
    limiter.check("2.2.2.2");
    expect(limiter.size).toBe(2);

    vi.advanceTimersByTime(2_000);
    limiter.cleanup();

    expect(limiter.size).toBe(0);
  });

  it("should reset all data", () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000, blockDurationMs: 300_000 });

    limiter.check("1.1.1.1");
    limiter.check("2.2.2.2");
    expect(limiter.size).toBe(2);

    limiter.reset();
    expect(limiter.size).toBe(0);
  });
});

describe("loadRateLimitConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should return defaults when env vars are not set", () => {
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_BLOCK_DURATION_MS;

    const config = loadRateLimitConfig();
    expect(config.maxRequests).toBe(20);
    expect(config.windowMs).toBe(60_000);
    expect(config.blockDurationMs).toBe(300_000);
  });

  // AC: Limite configurable de requêtes par IP par fenêtre de temps
  it("should use env vars when set", () => {
    process.env.RATE_LIMIT_MAX_REQUESTS = "50";
    process.env.RATE_LIMIT_WINDOW_MS = "120000";
    process.env.RATE_LIMIT_BLOCK_DURATION_MS = "600000";

    const config = loadRateLimitConfig();
    expect(config.maxRequests).toBe(50);
    expect(config.windowMs).toBe(120_000);
    expect(config.blockDurationMs).toBe(600_000);
  });

  it("should fall back to defaults for invalid values", () => {
    process.env.RATE_LIMIT_MAX_REQUESTS = "not-a-number";
    process.env.RATE_LIMIT_WINDOW_MS = "-1";
    process.env.RATE_LIMIT_BLOCK_DURATION_MS = "0";

    const config = loadRateLimitConfig();
    expect(config.maxRequests).toBe(20);
    expect(config.windowMs).toBe(60_000);
    expect(config.blockDurationMs).toBe(300_000);
  });
});

describe("getBookingRateLimiter singleton", () => {
  afterEach(() => {
    resetBookingRateLimiter();
  });

  it("should return the same instance on multiple calls", () => {
    const a = getBookingRateLimiter();
    const b = getBookingRateLimiter();
    expect(a).toBe(b);
  });

  it("should return a new instance after reset", () => {
    const a = getBookingRateLimiter();
    resetBookingRateLimiter();
    const b = getBookingRateLimiter();
    expect(a).not.toBe(b);
  });
});
