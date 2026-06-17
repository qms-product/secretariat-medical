import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "../route";
import {
  startFlowTracking,
  completeFlowTracking,
  _clearAll,
} from "@/lib/flow-duration-monitor";

function makeRequest(url: string) {
  return { url } as unknown as import("next/server").NextRequest;
}

describe("GET /api/monitoring/metrics (IMP-37)", () => {
  beforeEach(() => {
    _clearAll();
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    _clearAll();
  });

  it("should return empty metrics when no flows exist", async () => {
    const response = await GET(
      makeRequest("http://localhost:3001/api/monitoring/metrics")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.metrics.totalCompleted).toBe(0);
    expect(data.metrics.totalActive).toBe(0);
    expect(data.metrics.averageDurationMs).toBe(0);
    expect(data.metrics.thresholdMs).toBe(120_000);
  });

  it("should return metrics for completed flows", async () => {
    startFlowTracking("m1");
    vi.advanceTimersByTime(45_000);
    completeFlowTracking("m1", "BOOKING");

    startFlowTracking("m2");
    vi.advanceTimersByTime(60_000);
    completeFlowTracking("m2", "BOOKING");

    const response = await GET(
      makeRequest("http://localhost:3001/api/monitoring/metrics")
    );
    const data = await response.json();

    expect(data.metrics.totalCompleted).toBe(2);
    expect(data.metrics.averageDurationMs).toBe(52_500); // (45000+60000)/2
    expect(data.metrics.thresholdExceededCount).toBe(0);
  });

  it("should include recent flows when requested", async () => {
    startFlowTracking("recent1");
    vi.advanceTimersByTime(5_000);
    completeFlowTracking("recent1", "BOOKING");

    const response = await GET(
      makeRequest("http://localhost:3001/api/monitoring/metrics?recent=5")
    );
    const data = await response.json();

    expect(data.recentFlows).toBeDefined();
    expect(data.recentFlows.length).toBe(1);
    expect(data.recentFlows[0].conversationId).toBe("recent1");
  });

  it("should not include recent flows by default", async () => {
    const response = await GET(
      makeRequest("http://localhost:3001/api/monitoring/metrics")
    );
    const data = await response.json();

    expect(data.recentFlows).toBeUndefined();
  });

  it("should cap recent param at 100", async () => {
    for (let i = 0; i < 5; i++) {
      startFlowTracking(`cap_${i}`);
      vi.advanceTimersByTime(5_000);
      completeFlowTracking(`cap_${i}`, "BOOKING");
    }

    const response = await GET(
      makeRequest("http://localhost:3001/api/monitoring/metrics?recent=999")
    );
    const data = await response.json();

    // Should return all 5 (capped at 100, but we only have 5)
    expect(data.recentFlows.length).toBe(5);
  });

  it("should report active flow count", async () => {
    startFlowTracking("active_1");
    startFlowTracking("active_2");

    const response = await GET(
      makeRequest("http://localhost:3001/api/monitoring/metrics")
    );
    const data = await response.json();

    expect(data.metrics.totalActive).toBe(2);
  });
});
