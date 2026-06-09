import { describe, it, expect } from "vitest";
import {
  mapElevenLabsTtsError,
  VOICE_FLOW_ERRORS,
  VoiceFlowErrorType,
} from "../errors";

const ttsErrors = VOICE_FLOW_ERRORS[VoiceFlowErrorType.TTS_SYNTHESIS];

describe("ElevenLabs TTS error handling (IMP-11 / ADR-3)", () => {
  describe("mapElevenLabsTtsError", () => {
    it("should return timeout error info for timeout scenario", () => {
      // Timeout is handled at the route level via AbortController,
      // but verify the timeout error entry exists and is well-formed.
      const info = ttsErrors.timeout;
      expect(info.code).toBe("TTS_SYNTHESIS_TIMEOUT");
      expect(info.type).toBe(VoiceFlowErrorType.TTS_SYNTHESIS);
      expect(info.message).toBeTruthy();
      expect(info.suggestions.length).toBeGreaterThan(0);
    });

    it("should return quota error for HTTP 429", () => {
      const result = mapElevenLabsTtsError(429, "rate limit exceeded");
      expect(result.code).toBe("TTS_SYNTHESIS_QUOTA_EXCEEDED");
      expect(result.type).toBe(VoiceFlowErrorType.TTS_SYNTHESIS);
      expect(result.message).toContain("quota");
    });

    it("should return service unavailable error for HTTP 503", () => {
      const result = mapElevenLabsTtsError(503, "service unavailable");
      expect(result.code).toBe("TTS_SYNTHESIS_SERVICE_UNAVAILABLE");
      expect(result.type).toBe(VoiceFlowErrorType.TTS_SYNTHESIS);
      expect(result.message).toContain("indisponible");
    });

    it("should return service unavailable error for HTTP 502", () => {
      const result = mapElevenLabsTtsError(502, "bad gateway");
      expect(result.code).toBe("TTS_SYNTHESIS_SERVICE_UNAVAILABLE");
    });

    it("should return service unavailable error for HTTP 504", () => {
      const result = mapElevenLabsTtsError(504, "gateway timeout");
      expect(result.code).toBe("TTS_SYNTHESIS_SERVICE_UNAVAILABLE");
    });

    it("should return text too long error for HTTP 422 with length message", () => {
      const result = mapElevenLabsTtsError(
        422,
        '{"detail": "text_too_long: Text exceeds maximum length"}'
      );
      expect(result.code).toBe("TTS_SYNTHESIS_TEXT_TOO_LONG");
      expect(result.type).toBe(VoiceFlowErrorType.TTS_SYNTHESIS);
      expect(result.message).toContain("trop long");
    });

    it("should return text too long error for HTTP 400 with too long message", () => {
      const result = mapElevenLabsTtsError(
        400,
        '{"detail": "Text is too long for synthesis"}'
      );
      expect(result.code).toBe("TTS_SYNTHESIS_TEXT_TOO_LONG");
    });

    it("should return text too long error when body contains maximum keyword", () => {
      const result = mapElevenLabsTtsError(
        422,
        '{"detail": "Exceeds maximum character count"}'
      );
      expect(result.code).toBe("TTS_SYNTHESIS_TEXT_TOO_LONG");
    });

    it("should return text too long error when body contains limit keyword", () => {
      const result = mapElevenLabsTtsError(
        400,
        '{"detail": "Character limit exceeded"}'
      );
      expect(result.code).toBe("TTS_SYNTHESIS_TEXT_TOO_LONG");
    });

    it("should return default error for HTTP 422 without length indicators", () => {
      const result = mapElevenLabsTtsError(422, '{"detail": "invalid voice_id"}');
      expect(result.code).toBe("TTS_SYNTHESIS_FAILED");
    });

    it("should return default error for HTTP 401", () => {
      const result = mapElevenLabsTtsError(401, "unauthorized");
      expect(result.code).toBe("TTS_SYNTHESIS_FAILED");
    });

    it("should return default error for unknown status and body", () => {
      const result = mapElevenLabsTtsError(500, "internal server error");
      expect(result.code).toBe("TTS_SYNTHESIS_FAILED");
      expect(result.type).toBe(VoiceFlowErrorType.TTS_SYNTHESIS);
    });
  });

  describe("TTS error entries completeness", () => {
    it("should have all required TTS error entries", () => {
      expect(ttsErrors.default).toBeDefined();
      expect(ttsErrors.timeout).toBeDefined();
      expect(ttsErrors.quota).toBeDefined();
      expect(ttsErrors.textTooLong).toBeDefined();
      expect(ttsErrors.serviceUnavailable).toBeDefined();
    });

    it("should have unique error codes for all TTS errors", () => {
      const codes = Object.values(ttsErrors).map((e) => e.code);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it("should have suggestions for all TTS error types", () => {
      for (const entry of Object.values(ttsErrors)) {
        expect(entry.suggestions.length).toBeGreaterThan(0);
      }
    });

    it("should have TTS_SYNTHESIS type for all entries", () => {
      for (const entry of Object.values(ttsErrors)) {
        expect(entry.type).toBe(VoiceFlowErrorType.TTS_SYNTHESIS);
      }
    });
  });

  describe("Developer debug logging support", () => {
    it("should include enough detail for debugging in error codes", () => {
      expect(ttsErrors.timeout.code).toContain("TTS_SYNTHESIS");
      expect(ttsErrors.timeout.code).toContain("TIMEOUT");
      expect(ttsErrors.quota.code).toContain("QUOTA");
      expect(ttsErrors.textTooLong.code).toContain("TEXT_TOO_LONG");
      expect(ttsErrors.serviceUnavailable.code).toContain(
        "SERVICE_UNAVAILABLE"
      );
    });
  });
});
