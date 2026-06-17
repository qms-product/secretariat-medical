import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  startFlowTracking,
  completeFlowTracking,
  getActiveFlow,
  getFlowMetrics,
  getRecentFlows,
  FLOW_DURATION_THRESHOLD_MS,
  _clearAll,
  _getCompletedFlows,
} from "../flow-duration-monitor";

describe("flow-duration-monitor (IMP-37 / REQ-96)", () => {
  beforeEach(() => {
    _clearAll();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    _clearAll();
  });

  describe("FLOW_DURATION_THRESHOLD_MS", () => {
    it("should be set to 2 minutes (120000ms)", () => {
      expect(FLOW_DURATION_THRESHOLD_MS).toBe(120_000);
    });
  });

  describe("startFlowTracking", () => {
    it("should create a flow record with startedAt timestamp", () => {
      const record = startFlowTracking("conv_test_1");
      expect(record.conversationId).toBe("conv_test_1");
      expect(record.startedAt).toBeGreaterThan(0);
      expect(record.completedAt).toBeUndefined();
      expect(record.durationMs).toBeUndefined();
    });

    it("should add the flow to active flows", () => {
      startFlowTracking("conv_test_2");
      expect(getActiveFlow("conv_test_2")).toBeDefined();
    });

    it("should log flow start", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      startFlowTracking("conv_test_log");
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Flow started: conv_test_log")
      );
    });
  });

  describe("completeFlowTracking", () => {
    it("should calculate duration and mark as completed", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      startFlowTracking("conv_dur_1");
      vi.advanceTimersByTime(30_000);
      const record = completeFlowTracking("conv_dur_1", "BOOKING");

      expect(record).toBeDefined();
      expect(record!.durationMs).toBe(30_000);
      expect(record!.finalState).toBe("BOOKING");
      expect(record!.exceededThreshold).toBe(false);
    });

    it("should flag flows exceeding 2-minute threshold", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
      startFlowTracking("conv_slow");
      vi.advanceTimersByTime(150_000); // 2.5 minutes
      const record = completeFlowTracking("conv_slow", "BOOKING");

      expect(record!.exceededThreshold).toBe(true);
      expect(record!.durationMs).toBe(150_000);
    });

    it("should remove completed flow from active flows", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      startFlowTracking("conv_remove");
      completeFlowTracking("conv_remove", "BOOKING");
      expect(getActiveFlow("conv_remove")).toBeUndefined();
    });

    it("should add completed flow to completed records", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      startFlowTracking("conv_record");
      completeFlowTracking("conv_record", "BOOKING");
      expect(_getCompletedFlows().length).toBe(1);
    });

    it("should return undefined for unknown conversation", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = completeFlowTracking("nonexistent", "BOOKING");
      expect(result).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("No active flow found")
      );
    });

    it("should log warning when threshold is exceeded", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      startFlowTracking("conv_warn");
      vi.advanceTimersByTime(150_000);
      completeFlowTracking("conv_warn", "BOOKING");

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("THRESHOLD EXCEEDED")
      );
    });

    it("should log normal completion for flows within threshold", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      startFlowTracking("conv_ok");
      vi.advanceTimersByTime(30_000);
      completeFlowTracking("conv_ok", "BOOKING");

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Flow completed: conv_ok")
      );
    });
  });

  describe("getFlowMetrics — average duration calculation", () => {
    it("should return zero metrics when no flows completed", () => {
      const metrics = getFlowMetrics();
      expect(metrics.totalCompleted).toBe(0);
      expect(metrics.averageDurationMs).toBe(0);
      expect(metrics.thresholdExceededCount).toBe(0);
      expect(metrics.thresholdExceededPercent).toBe(0);
      expect(metrics.minDurationMs).toBe(0);
      expect(metrics.maxDurationMs).toBe(0);
    });

    it("should calculate average duration across completed flows", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      startFlowTracking("conv_a");
      vi.advanceTimersByTime(20_000);
      completeFlowTracking("conv_a", "BOOKING");

      startFlowTracking("conv_b");
      vi.advanceTimersByTime(40_000);
      completeFlowTracking("conv_b", "BOOKING");

      const metrics = getFlowMetrics();
      expect(metrics.totalCompleted).toBe(2);
      expect(metrics.averageDurationMs).toBe(30_000); // (20000 + 40000) / 2
    });

    it("should track threshold exceeded count and percentage", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});

      startFlowTracking("fast");
      vi.advanceTimersByTime(30_000);
      completeFlowTracking("fast", "BOOKING");

      startFlowTracking("slow");
      vi.advanceTimersByTime(150_000);
      completeFlowTracking("slow", "BOOKING");

      startFlowTracking("medium");
      vi.advanceTimersByTime(60_000);
      completeFlowTracking("medium", "NO_SLOTS_AVAILABLE");

      const metrics = getFlowMetrics();
      expect(metrics.totalCompleted).toBe(3);
      expect(metrics.thresholdExceededCount).toBe(1);
      expect(metrics.thresholdExceededPercent).toBe(33); // 1/3 ≈ 33%
    });

    it("should calculate min and max durations", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      startFlowTracking("short");
      vi.advanceTimersByTime(10_000);
      completeFlowTracking("short", "BOOKING");

      startFlowTracking("long");
      vi.advanceTimersByTime(50_000);
      completeFlowTracking("long", "BOOKING");

      startFlowTracking("mid");
      vi.advanceTimersByTime(30_000);
      completeFlowTracking("mid", "BOOKING");

      const metrics = getFlowMetrics();
      expect(metrics.minDurationMs).toBe(10_000);
      expect(metrics.maxDurationMs).toBe(50_000);
    });

    it("should track active flow count", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      startFlowTracking("active1");
      startFlowTracking("active2");
      const metrics = getFlowMetrics();
      expect(metrics.totalActive).toBe(2);
    });

    it("should include threshold value in metrics", () => {
      const metrics = getFlowMetrics();
      expect(metrics.thresholdMs).toBe(FLOW_DURATION_THRESHOLD_MS);
    });
  });

  describe("getRecentFlows", () => {
    it("should return recent completed flows", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      startFlowTracking("r1");
      vi.advanceTimersByTime(5_000);
      completeFlowTracking("r1", "BOOKING");

      startFlowTracking("r2");
      vi.advanceTimersByTime(5_000);
      completeFlowTracking("r2", "BOOKING");

      const recent = getRecentFlows(10);
      expect(recent.length).toBe(2);
      expect(recent[0].conversationId).toBe("r1");
      expect(recent[1].conversationId).toBe("r2");
    });

    it("should limit results to requested count", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      for (let i = 0; i < 5; i++) {
        startFlowTracking(`limit_${i}`);
        vi.advanceTimersByTime(5_000);
        completeFlowTracking(`limit_${i}`, "BOOKING");
      }

      const recent = getRecentFlows(3);
      expect(recent.length).toBe(3);
      // Should return the 3 most recent
      expect(recent[0].conversationId).toBe("limit_2");
      expect(recent[2].conversationId).toBe("limit_4");
    });
  });

  describe("getActiveFlow", () => {
    it("should return active flow by conversationId", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      startFlowTracking("active_test");
      const flow = getActiveFlow("active_test");
      expect(flow).toBeDefined();
      expect(flow!.conversationId).toBe("active_test");
    });

    it("should return undefined for unknown conversationId", () => {
      expect(getActiveFlow("unknown")).toBeUndefined();
    });
  });

  describe("circular buffer — MAX_RECORDS limit", () => {
    it("should evict oldest records when buffer is full", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      // Fill beyond MAX_RECORDS (1000)
      for (let i = 0; i < 1002; i++) {
        startFlowTracking(`buf_${i}`);
        vi.advanceTimersByTime(1);
        completeFlowTracking(`buf_${i}`, "BOOKING");
      }

      const completed = _getCompletedFlows();
      expect(completed.length).toBe(1000);
      // Oldest records (buf_0, buf_1) should have been evicted
      expect(completed[0].conversationId).toBe("buf_2");
      expect(completed[completed.length - 1].conversationId).toBe("buf_1001");
    });
  });
});
