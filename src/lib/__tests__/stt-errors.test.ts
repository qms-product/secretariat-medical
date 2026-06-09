import { describe, it, expect } from "vitest";
import {
  mapElevenLabsSttError,
  VOICE_FLOW_ERRORS,
  VoiceFlowErrorType,
} from "../errors";

const sttErrors = VOICE_FLOW_ERRORS[VoiceFlowErrorType.STT_TRANSCRIPTION];

describe("ElevenLabs STT error handling (IMP-9 / ADR-3)", () => {
  describe("mapElevenLabsSttError", () => {
    it("should return timeout error info for timeout scenario", () => {
      // Timeout is handled at the route level via AbortController,
      // but verify the timeout error entry exists and is well-formed.
      const info = sttErrors.timeout;
      expect(info.code).toBe("STT_TRANSCRIPTION_TIMEOUT");
      expect(info.type).toBe(VoiceFlowErrorType.STT_TRANSCRIPTION);
      expect(info.message).toBeTruthy();
      expect(info.suggestions.length).toBeGreaterThan(0);
    });

    it("should return quota error for HTTP 429", () => {
      const result = mapElevenLabsSttError(429, "rate limit exceeded");
      expect(result.code).toBe("STT_TRANSCRIPTION_QUOTA_EXCEEDED");
      expect(result.type).toBe(VoiceFlowErrorType.STT_TRANSCRIPTION);
      expect(result.message).toContain("quota");
    });

    it("should return audio format error for HTTP 422", () => {
      const result = mapElevenLabsSttError(422, "invalid audio");
      expect(result.code).toBe("STT_TRANSCRIPTION_AUDIO_FORMAT");
      expect(result.type).toBe(VoiceFlowErrorType.STT_TRANSCRIPTION);
      expect(result.message).toContain("format");
    });

    it("should return audio format error for HTTP 415", () => {
      const result = mapElevenLabsSttError(415, "unsupported media type");
      expect(result.code).toBe("STT_TRANSCRIPTION_AUDIO_FORMAT");
    });

    it("should return service unavailable error for HTTP 503", () => {
      const result = mapElevenLabsSttError(503, "service unavailable");
      expect(result.code).toBe("STT_TRANSCRIPTION_SERVICE_UNAVAILABLE");
      expect(result.type).toBe(VoiceFlowErrorType.STT_TRANSCRIPTION);
      expect(result.message).toContain("indisponible");
    });

    it("should return service unavailable error for HTTP 502", () => {
      const result = mapElevenLabsSttError(502, "bad gateway");
      expect(result.code).toBe("STT_TRANSCRIPTION_SERVICE_UNAVAILABLE");
    });

    it("should return service unavailable error for HTTP 504", () => {
      const result = mapElevenLabsSttError(504, "gateway timeout");
      expect(result.code).toBe("STT_TRANSCRIPTION_SERVICE_UNAVAILABLE");
    });

    it("should return default error for HTTP 401", () => {
      const result = mapElevenLabsSttError(401, "unauthorized");
      expect(result.code).toBe("STT_TRANSCRIPTION_FAILED");
    });

    it("should return default error for HTTP 403", () => {
      const result = mapElevenLabsSttError(403, "forbidden");
      expect(result.code).toBe("STT_TRANSCRIPTION_FAILED");
    });

    it("should detect audio format issues from response body", () => {
      const result = mapElevenLabsSttError(
        400,
        '{"detail": "Unsupported audio format"}'
      );
      expect(result.code).toBe("STT_TRANSCRIPTION_AUDIO_FORMAT");
    });

    it("should detect format keyword in response body", () => {
      const result = mapElevenLabsSttError(
        400,
        '{"error": "invalid format provided"}'
      );
      expect(result.code).toBe("STT_TRANSCRIPTION_AUDIO_FORMAT");
    });

    it("should return default error for unknown status and body", () => {
      const result = mapElevenLabsSttError(500, "internal server error");
      expect(result.code).toBe("STT_TRANSCRIPTION_FAILED");
      expect(result.type).toBe(VoiceFlowErrorType.STT_TRANSCRIPTION);
    });
  });

  describe("STT error entries completeness", () => {
    it("should have all required STT error entries", () => {
      expect(sttErrors.default).toBeDefined();
      expect(sttErrors.timeout).toBeDefined();
      expect(sttErrors.quota).toBeDefined();
      expect(sttErrors.audioFormat).toBeDefined();
      expect(sttErrors.serviceUnavailable).toBeDefined();
    });

    it("should have unique error codes for all STT errors", () => {
      const codes = Object.values(sttErrors).map((e) => e.code);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it("should have suggestions for all STT error types", () => {
      for (const entry of Object.values(sttErrors)) {
        expect(entry.suggestions.length).toBeGreaterThan(0);
      }
    });

    it("should have STT_TRANSCRIPTION type for all entries", () => {
      for (const entry of Object.values(sttErrors)) {
        expect(entry.type).toBe(VoiceFlowErrorType.STT_TRANSCRIPTION);
      }
    });
  });

  describe("Developer debug logging support", () => {
    it("should include enough detail for debugging in error codes", () => {
      // Each error code should contain the step name and specific cause
      expect(sttErrors.timeout.code).toContain("STT_TRANSCRIPTION");
      expect(sttErrors.timeout.code).toContain("TIMEOUT");
      expect(sttErrors.quota.code).toContain("QUOTA");
      expect(sttErrors.audioFormat.code).toContain("AUDIO_FORMAT");
      expect(sttErrors.serviceUnavailable.code).toContain(
        "SERVICE_UNAVAILABLE"
      );
    });
  });
});
