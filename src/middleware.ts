import { NextRequest, NextResponse } from "next/server";
import { getBookingRateLimiter, loadRateLimitConfig } from "@/lib/rate-limiter";

/**
 * Next.js middleware — applies IP-based rate limiting to booking API routes (ADR-13, IMP-33).
 * Returns 429 with Rate-Limit headers when limits are exceeded.
 */
export function middleware(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const limiter = getBookingRateLimiter();
  const result = limiter.check(ip);
  const config = loadRateLimitConfig();

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Veuillez réessayer plus tard." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((result.retryAfterMs ?? 0) / 1000)),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(config.maxRequests));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

  return response;
}

/**
 * Apply rate limiting only to Cal.com booking API routes.
 */
export const config = {
  matcher: ["/api/calcom/book", "/api/calcom/availability"],
};
