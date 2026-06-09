import { describe, it, expect } from "vitest";
import {
  mapClaudeApiError,
  VOICE_FLOW_ERRORS,
  VoiceFlowErrorType,
} from "../errors";

const claudeErrors = VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING];

describe("Claude API error handling (IMP-10 / ADR-3)", () => {
  describe("mapClaudeApiError", () => {
    it("should return timeout error info for timeout scenario", () => {
      const info = claudeErrors.timeout;
      expect(info.code).toBe("CLAUDE_PROCESSING_TIMEOUT");
      expect(info.type).toBe(VoiceFlowErrorType.CLAUDE_PROCESSING);
      expect(info.message).toBeTruthy();
      expect(info.suggestions.length).toBeGreaterThan(0);
    });

    it("should return quota error for HTTP 429", () => {
      const result = mapClaudeApiError(429, "rate limit exceeded");
      expect(result.code).toBe("CLAUDE_PROCESSING_QUOTA_EXCEEDED");
      expect(result.type).toBe(VoiceFlowErrorType.CLAUDE_PROCESSING);
      expect(result.message).toContain("quota");
    });

    it("should return service unavailable error for HTTP 529 (overloaded)", () => {
      const result = mapClaudeApiError(529, "overloaded");
      expect(result.code).toBe("CLAUDE_PROCESSING_SERVICE_UNAVAILABLE");
      expect(result.type).toBe(VoiceFlowErrorType.CLAUDE_PROCESSING);
      expect(result.message).toContain("indisponible");
    });

    it("should return service unavailable error for HTTP 503", () => {
      const result = mapClaudeApiError(503, "service unavailable");
      expect(result.code).toBe("CLAUDE_PROCESSING_SERVICE_UNAVAILABLE");
    });

    it("should return service unavailable error for HTTP 502", () => {
      const result = mapClaudeApiError(502, "bad gateway");
      expect(result.code).toBe("CLAUDE_PROCESSING_SERVICE_UNAVAILABLE");
    });

    it("should return service unavailable error for HTTP 504", () => {
      const result = mapClaudeApiError(504, "gateway timeout");
      expect(result.code).toBe("CLAUDE_PROCESSING_SERVICE_UNAVAILABLE");
    });

    it("should return content filtered error for inappropriate content in body", () => {
      const result = mapClaudeApiError(
        400,
        '{"error": "content flagged as inappropriate"}'
      );
      expect(result.code).toBe("CLAUDE_PROCESSING_CONTENT_FILTERED");
      expect(result.type).toBe(VoiceFlowErrorType.CLAUDE_PROCESSING);
      expect(result.message).toContain("inapproprie");
    });

    it("should detect harmful content keyword in response body", () => {
      const result = mapClaudeApiError(
        400,
        '{"error": "harmful content detected"}'
      );
      expect(result.code).toBe("CLAUDE_PROCESSING_CONTENT_FILTERED");
    });

    it("should detect unsafe content keyword in response body", () => {
      const result = mapClaudeApiError(
        400,
        '{"error": "unsafe request blocked"}'
      );
      expect(result.code).toBe("CLAUDE_PROCESSING_CONTENT_FILTERED");
    });

    it("should return default error for unknown HTTP 400 without content keywords", () => {
      const result = mapClaudeApiError(400, '{"error": "bad request"}');
      expect(result.code).toBe("CLAUDE_PROCESSING_FAILED");
    });

    it("should return default error for unknown status", () => {
      const result = mapClaudeApiError(500, "internal server error");
      expect(result.code).toBe("CLAUDE_PROCESSING_FAILED");
      expect(result.type).toBe(VoiceFlowErrorType.CLAUDE_PROCESSING);
    });

    it("should return default error for HTTP 401", () => {
      const result = mapClaudeApiError(401, "unauthorized");
      expect(result.code).toBe("CLAUDE_PROCESSING_FAILED");
    });
  });

  describe("Claude error entries completeness", () => {
    it("should have all required Claude error entries", () => {
      expect(claudeErrors.default).toBeDefined();
      expect(claudeErrors.timeout).toBeDefined();
      expect(claudeErrors.quota).toBeDefined();
      expect(claudeErrors.contentFiltered).toBeDefined();
      expect(claudeErrors.serviceUnavailable).toBeDefined();
    });

    it("should have unique error codes for all Claude errors", () => {
      const codes = Object.values(claudeErrors).map((e) => e.code);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it("should have suggestions for all Claude error types", () => {
      for (const entry of Object.values(claudeErrors)) {
        expect(entry.suggestions.length).toBeGreaterThan(0);
      }
    });

    it("should have CLAUDE_PROCESSING type for all entries", () => {
      for (const entry of Object.values(claudeErrors)) {
        expect(entry.type).toBe(VoiceFlowErrorType.CLAUDE_PROCESSING);
      }
    });
  });

  describe("Developer debug logging support", () => {
    it("should include enough detail for debugging in error codes", () => {
      expect(claudeErrors.timeout.code).toContain("CLAUDE_PROCESSING");
      expect(claudeErrors.timeout.code).toContain("TIMEOUT");
      expect(claudeErrors.quota.code).toContain("QUOTA");
      expect(claudeErrors.contentFiltered.code).toContain("CONTENT_FILTERED");
      expect(claudeErrors.serviceUnavailable.code).toContain(
        "SERVICE_UNAVAILABLE"
      );
    });

    it("should have user-facing messages in French", () => {
      for (const entry of Object.values(claudeErrors)) {
        // All messages should be non-empty French text
        expect(entry.message.length).toBeGreaterThan(10);
      }
    });
  });
});
