import { describe, it, expect } from "vitest";
import {
  VoiceFlowError,
  VoiceFlowErrorType,
  ERROR_MESSAGES,
  VOICE_FLOW_ERRORS,
  ERROR_TYPE_TO_STEP,
  type VoiceFlowErrorInfo,
  type VoiceFlowStep,
} from "../errors";

describe("Error handling (ADR-3 / IMP-7)", () => {
  describe("VoiceFlowErrorType enum", () => {
    it("should define error types for each voice flow step", () => {
      expect(VoiceFlowErrorType.AUDIO_CAPTURE).toBe("AUDIO_CAPTURE");
      expect(VoiceFlowErrorType.STT_TRANSCRIPTION).toBe("STT_TRANSCRIPTION");
      expect(VoiceFlowErrorType.CLAUDE_PROCESSING).toBe("CLAUDE_PROCESSING");
      expect(VoiceFlowErrorType.TTS_SYNTHESIS).toBe("TTS_SYNTHESIS");
    });

    it("should have exactly 5 error types", () => {
      const values = Object.values(VoiceFlowErrorType);
      expect(values).toHaveLength(5);
    });
  });

  describe("VoiceFlowErrorInfo interface", () => {
    it("should have code, message and suggestions for each default error", () => {
      for (const errorType of Object.values(VoiceFlowErrorType)) {
        const info: VoiceFlowErrorInfo =
          VOICE_FLOW_ERRORS[errorType].default;
        expect(info.type).toBe(errorType);
        expect(info.code).toBeTruthy();
        expect(info.message).toBeTruthy();
        expect(info.suggestions).toBeInstanceOf(Array);
        expect(info.suggestions.length).toBeGreaterThan(0);
      }
    });

    it("should have unique error codes across all errors", () => {
      const codes = new Set<string>();
      for (const errorType of Object.values(VoiceFlowErrorType)) {
        for (const info of Object.values(VOICE_FLOW_ERRORS[errorType])) {
          expect(codes.has(info.code)).toBe(false);
          codes.add(info.code);
        }
      }
    });
  });

  describe("ERROR_TYPE_TO_STEP mapping", () => {
    it("should map each error type to the correct step", () => {
      expect(ERROR_TYPE_TO_STEP[VoiceFlowErrorType.AUDIO_CAPTURE]).toBe(
        "capture"
      );
      expect(ERROR_TYPE_TO_STEP[VoiceFlowErrorType.STT_TRANSCRIPTION]).toBe(
        "transcription"
      );
      expect(ERROR_TYPE_TO_STEP[VoiceFlowErrorType.CLAUDE_PROCESSING]).toBe(
        "processing"
      );
      expect(ERROR_TYPE_TO_STEP[VoiceFlowErrorType.TTS_SYNTHESIS]).toBe(
        "synthesis"
      );
    });
  });

  describe("VoiceFlowError class", () => {
    it("should create VoiceFlowError with step info", () => {
      const err = new VoiceFlowError("capture", "test error");
      expect(err.step).toBe("capture");
      expect(err.message).toBe("test error");
      expect(err.name).toBe("VoiceFlowError");
    });

    it("should be an instance of Error", () => {
      const err = new VoiceFlowError("transcription", "test");
      expect(err).toBeInstanceOf(Error);
    });

    it("should include default errorInfo when none provided", () => {
      const err = new VoiceFlowError("processing", "test");
      expect(err.errorInfo.type).toBe(VoiceFlowErrorType.CLAUDE_PROCESSING);
      expect(err.errorInfo.code).toBe("CLAUDE_PROCESSING_FAILED");
      expect(err.errorInfo.suggestions.length).toBeGreaterThan(0);
    });

    it("should accept a custom errorInfo", () => {
      const customInfo: VoiceFlowErrorInfo = {
        type: VoiceFlowErrorType.AUDIO_CAPTURE,
        code: "AUDIO_CAPTURE_PERMISSION_DENIED",
        message: "Permission denied",
        suggestions: ["Allow microphone"],
      };
      const err = new VoiceFlowError(
        "capture",
        "Permission denied",
        undefined,
        customInfo
      );
      expect(err.errorInfo).toBe(customInfo);
    });

    it("should preserve the cause", () => {
      const cause = new Error("original");
      const err = new VoiceFlowError("synthesis", "wrapper", cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe("VoiceFlowError.fromErrorInfo", () => {
    it("should create error from an error info object", () => {
      const info =
        VOICE_FLOW_ERRORS[VoiceFlowErrorType.STT_TRANSCRIPTION].timeout;
      const err = VoiceFlowError.fromErrorInfo(info);
      expect(err.step).toBe("transcription");
      expect(err.message).toBe(info.message);
      expect(err.errorInfo).toBe(info);
    });

    it("should preserve cause when using fromErrorInfo", () => {
      const info =
        VOICE_FLOW_ERRORS[VoiceFlowErrorType.TTS_SYNTHESIS].default;
      const cause = new Error("network");
      const err = VoiceFlowError.fromErrorInfo(info, cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe("Legacy ERROR_MESSAGES compatibility", () => {
    it("should have error messages for all voice flow steps", () => {
      expect(ERROR_MESSAGES.capture).toBeTruthy();
      expect(ERROR_MESSAGES.transcription).toBeTruthy();
      expect(ERROR_MESSAGES.processing).toBeTruthy();
      expect(ERROR_MESSAGES.synthesis).toBeTruthy();
    });

    it("should match default VOICE_FLOW_ERRORS messages", () => {
      const steps: VoiceFlowStep[] = [
        "capture",
        "transcription",
        "processing",
        "synthesis",
      ];
      const typeMap: Record<VoiceFlowStep, VoiceFlowErrorType> = {
        capture: VoiceFlowErrorType.AUDIO_CAPTURE,
        transcription: VoiceFlowErrorType.STT_TRANSCRIPTION,
        processing: VoiceFlowErrorType.CLAUDE_PROCESSING,
        synthesis: VoiceFlowErrorType.TTS_SYNTHESIS,
      };
      for (const step of steps) {
        expect(ERROR_MESSAGES[step]).toBe(
          VOICE_FLOW_ERRORS[typeMap[step]].default.message
        );
      }
    });
  });

  describe("VOICE_FLOW_ERRORS pre-defined errors", () => {
    it("should have audio capture specific errors", () => {
      const capture = VOICE_FLOW_ERRORS[VoiceFlowErrorType.AUDIO_CAPTURE];
      expect(capture.default).toBeDefined();
      expect(capture.permissionDenied).toBeDefined();
      expect(capture.notFound).toBeDefined();
    });

    it("should have timeout errors for external service steps", () => {
      expect(
        VOICE_FLOW_ERRORS[VoiceFlowErrorType.STT_TRANSCRIPTION].timeout
      ).toBeDefined();
      expect(
        VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING].timeout
      ).toBeDefined();
      expect(
        VOICE_FLOW_ERRORS[VoiceFlowErrorType.TTS_SYNTHESIS].timeout
      ).toBeDefined();
    });
  });

  describe("Frontend and API compatibility", () => {
    it("should export types usable on both frontend and API", () => {
      // VoiceFlowStep is used by the frontend page.tsx
      const step: VoiceFlowStep = "capture";
      expect(step).toBe("capture");

      // VoiceFlowErrorType enum is usable in API routes
      const errorType: VoiceFlowErrorType = VoiceFlowErrorType.AUDIO_CAPTURE;
      expect(errorType).toBeTruthy();

      // VoiceFlowErrorInfo can be serialized as JSON for API responses
      const info = VOICE_FLOW_ERRORS[VoiceFlowErrorType.AUDIO_CAPTURE].default;
      const serialized = JSON.parse(JSON.stringify(info));
      expect(serialized.type).toBe(info.type);
      expect(serialized.code).toBe(info.code);
      expect(serialized.message).toBe(info.message);
      expect(serialized.suggestions).toEqual(info.suggestions);
    });
  });
});
