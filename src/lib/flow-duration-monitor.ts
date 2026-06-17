/**
 * Conversation Flow Duration Monitor (IMP-37 / REQ-96)
 *
 * Measures and monitors the total duration of appointment booking flows.
 * Tracks time from conversation start to confirmation, calculates averages,
 * and alerts when flows exceed the 2-minute threshold.
 */

/** Maximum acceptable flow duration in milliseconds (REQ-96: 2 minutes) */
export const FLOW_DURATION_THRESHOLD_MS = 2 * 60 * 1000;

/** Maximum number of completed flow records to retain */
const MAX_RECORDS = 1000;

export interface FlowTimestamp {
  /** Conversation session ID */
  conversationId: string;
  /** Timestamp when the flow started (conversation/start) */
  startedAt: number;
  /** Timestamp when the flow completed (BOOKING or terminal state) */
  completedAt?: number;
  /** Total duration in milliseconds */
  durationMs?: number;
  /** Whether the flow exceeded the threshold */
  exceededThreshold?: boolean;
  /** Final conversation state */
  finalState?: string;
}

export interface FlowMetrics {
  /** Total number of completed flows */
  totalCompleted: number;
  /** Total number of active (in-progress) flows */
  totalActive: number;
  /** Average duration of completed flows in milliseconds */
  averageDurationMs: number;
  /** Number of flows that exceeded the 2-minute threshold */
  thresholdExceededCount: number;
  /** Percentage of flows that exceeded the threshold */
  thresholdExceededPercent: number;
  /** Minimum completed flow duration in milliseconds */
  minDurationMs: number;
  /** Maximum completed flow duration in milliseconds */
  maxDurationMs: number;
  /** Threshold value in milliseconds */
  thresholdMs: number;
}

/** In-memory store for active flows (keyed by conversationId) */
const activeFlows = new Map<string, FlowTimestamp>();

/** Completed flow records (circular buffer) */
const completedFlows: FlowTimestamp[] = [];

/**
 * Start tracking a conversation flow.
 * Called when a conversation session is initiated (POST /api/conversation/start).
 */
export function startFlowTracking(conversationId: string): FlowTimestamp {
  const record: FlowTimestamp = {
    conversationId,
    startedAt: Date.now(),
  };
  activeFlows.set(conversationId, record);

  console.log(
    `[flow-monitor] Flow started: ${conversationId}`
  );

  return record;
}

/**
 * Complete tracking for a conversation flow.
 * Called when a conversation reaches a terminal state (BOOKING or NO_SLOTS_AVAILABLE).
 * Logs a warning if the flow exceeded the 2-minute threshold.
 */
export function completeFlowTracking(
  conversationId: string,
  finalState: string
): FlowTimestamp | undefined {
  const record = activeFlows.get(conversationId);
  if (!record) {
    console.warn(
      `[flow-monitor] No active flow found for: ${conversationId}`
    );
    return undefined;
  }

  record.completedAt = Date.now();
  record.durationMs = record.completedAt - record.startedAt;
  record.exceededThreshold = record.durationMs > FLOW_DURATION_THRESHOLD_MS;
  record.finalState = finalState;

  activeFlows.delete(conversationId);

  // Maintain circular buffer
  if (completedFlows.length >= MAX_RECORDS) {
    completedFlows.shift();
  }
  completedFlows.push(record);

  const durationSec = (record.durationMs / 1000).toFixed(1);

  if (record.exceededThreshold) {
    console.warn(
      `[flow-monitor] THRESHOLD EXCEEDED: ${conversationId} took ${durationSec}s (threshold: ${FLOW_DURATION_THRESHOLD_MS / 1000}s, state: ${finalState})`
    );
  } else {
    console.log(
      `[flow-monitor] Flow completed: ${conversationId} in ${durationSec}s (state: ${finalState})`
    );
  }

  return record;
}

/**
 * Get the active flow record for a conversation.
 */
export function getActiveFlow(
  conversationId: string
): FlowTimestamp | undefined {
  return activeFlows.get(conversationId);
}

/**
 * Calculate aggregated metrics for all completed flows.
 */
export function getFlowMetrics(): FlowMetrics {
  const completed = completedFlows.filter(
    (f) => f.durationMs !== undefined
  );

  if (completed.length === 0) {
    return {
      totalCompleted: 0,
      totalActive: activeFlows.size,
      averageDurationMs: 0,
      thresholdExceededCount: 0,
      thresholdExceededPercent: 0,
      minDurationMs: 0,
      maxDurationMs: 0,
      thresholdMs: FLOW_DURATION_THRESHOLD_MS,
    };
  }

  const durations = completed.map((f) => f.durationMs!);
  const total = durations.reduce((sum, d) => sum + d, 0);
  const exceeded = completed.filter((f) => f.exceededThreshold).length;

  return {
    totalCompleted: completed.length,
    totalActive: activeFlows.size,
    averageDurationMs: Math.round(total / completed.length),
    thresholdExceededCount: exceeded,
    thresholdExceededPercent: Math.round((exceeded / completed.length) * 100),
    minDurationMs: Math.min(...durations),
    maxDurationMs: Math.max(...durations),
    thresholdMs: FLOW_DURATION_THRESHOLD_MS,
  };
}

/**
 * Get recent completed flow records.
 */
export function getRecentFlows(limit: number = 20): FlowTimestamp[] {
  return completedFlows.slice(-limit);
}

/** Expose internals for testing */
export function _getActiveFlows(): Map<string, FlowTimestamp> {
  return activeFlows;
}

export function _getCompletedFlows(): FlowTimestamp[] {
  return completedFlows;
}

export function _clearAll(): void {
  activeFlows.clear();
  completedFlows.length = 0;
}
