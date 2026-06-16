/**
 * IP-based rate limiter with sliding window (ADR-13, IMP-33).
 * Uses an in-memory Map to track requests per IP.
 * Configuration via environment variables with sensible defaults.
 */

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Block duration in milliseconds after limit exceeded */
  blockDurationMs: number;
}

interface ClientRecord {
  /** Timestamps of requests within the current window */
  timestamps: number[];
  /** If blocked, the time when the block expires */
  blockedUntil: number | null;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number | null;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60_000, // 1 minute
  blockDurationMs: 300_000, // 5 minutes
};

export function loadRateLimitConfig(): RateLimitConfig {
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "", 10);
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "", 10);
  const blockDurationMs = parseInt(process.env.RATE_LIMIT_BLOCK_DURATION_MS ?? "", 10);

  return {
    maxRequests: Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : DEFAULT_CONFIG.maxRequests,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DEFAULT_CONFIG.windowMs,
    blockDurationMs: Number.isFinite(blockDurationMs) && blockDurationMs > 0 ? blockDurationMs : DEFAULT_CONFIG.blockDurationMs,
  };
}

export class RateLimiter {
  private clients: Map<string, ClientRecord> = new Map();
  private config: RateLimitConfig;

  constructor(config?: RateLimitConfig) {
    this.config = config ?? loadRateLimitConfig();
  }

  /**
   * Check if a request from the given IP is allowed.
   * Returns rate limit result with remaining quota and reset time.
   */
  check(ip: string): RateLimitResult {
    const now = Date.now();
    let record = this.clients.get(ip);

    if (!record) {
      record = { timestamps: [], blockedUntil: null };
      this.clients.set(ip, record);
    }

    // Check if IP is currently blocked
    if (record.blockedUntil !== null && now < record.blockedUntil) {
      const retryAfterMs = record.blockedUntil - now;
      console.warn(
        `[rate-limit] IP bloquée: ${ip} | Bloquée jusqu'à: ${new Date(record.blockedUntil).toISOString()} | Tentative à: ${new Date(now).toISOString()}`
      );
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.blockedUntil,
        retryAfterMs,
      };
    }

    // Clear block if expired
    if (record.blockedUntil !== null && now >= record.blockedUntil) {
      record.blockedUntil = null;
      record.timestamps = [];
    }

    // Remove timestamps outside the current window
    const windowStart = now - this.config.windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    // Check if limit exceeded
    if (record.timestamps.length >= this.config.maxRequests) {
      record.blockedUntil = now + this.config.blockDurationMs;
      console.warn(
        `[rate-limit] Limite dépassée: ${ip} | Requêtes: ${record.timestamps.length}/${this.config.maxRequests} | Bloquée pour ${this.config.blockDurationMs}ms | Timestamp: ${new Date(now).toISOString()}`
      );
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.blockedUntil,
        retryAfterMs: this.config.blockDurationMs,
      };
    }

    // Allow request and record timestamp
    record.timestamps.push(now);
    const remaining = this.config.maxRequests - record.timestamps.length;
    const resetAt = (record.timestamps[0] ?? now) + this.config.windowMs;

    return {
      allowed: true,
      remaining,
      resetAt,
      retryAfterMs: null,
    };
  }

  /**
   * Remove expired entries to prevent memory leaks.
   * Should be called periodically.
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [ip, record] of this.clients.entries()) {
      // Remove if block expired and no recent timestamps
      const blockExpired = record.blockedUntil === null || now >= record.blockedUntil;
      const noRecentRequests = record.timestamps.every((ts) => ts <= windowStart);

      if (blockExpired && noRecentRequests) {
        this.clients.delete(ip);
      }
    }
  }

  /** Get current number of tracked IPs (for monitoring) */
  get size(): number {
    return this.clients.size;
  }

  /** Reset all tracked data (for testing) */
  reset(): void {
    this.clients.clear();
  }
}

/**
 * Singleton rate limiter instance for the booking API routes.
 * Cleanup runs every 5 minutes to prevent memory leaks.
 */
let instance: RateLimiter | null = null;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function getBookingRateLimiter(): RateLimiter {
  if (!instance) {
    instance = new RateLimiter();
    cleanupInterval = setInterval(() => instance?.cleanup(), 5 * 60_000);
    // Unref so the interval doesn't prevent process exit
    if (typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
      cleanupInterval.unref();
    }
  }
  return instance;
}

/** Reset singleton (for testing) */
export function resetBookingRateLimiter(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  instance = null;
}
