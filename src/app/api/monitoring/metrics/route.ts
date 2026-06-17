import { NextRequest, NextResponse } from "next/server";
import { getFlowMetrics, getRecentFlows } from "@/lib/flow-duration-monitor";

/**
 * GET /api/monitoring/metrics — Expose conversation flow duration metrics (IMP-37 / REQ-96)
 * Returns aggregated metrics and optional recent flow records.
 * Query params:
 *   - recent=N  Include the N most recent completed flow records (default: 0)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const recentParam = searchParams.get("recent");
  const recentCount = recentParam ? Math.min(Math.max(parseInt(recentParam, 10) || 0, 0), 100) : 0;

  const metrics = getFlowMetrics();

  const response: Record<string, unknown> = { metrics };

  if (recentCount > 0) {
    response.recentFlows = getRecentFlows(recentCount);
  }

  return NextResponse.json(response);
}
