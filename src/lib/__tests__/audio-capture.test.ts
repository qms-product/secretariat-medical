import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isAudioCaptureSupported,
  classifyAudioCaptureError,
  requestAudioCapture,
} from "../audio-capture";
import { VoiceFlowErrorType, VOICE_FLOW_ERRORS } from "../errors";

const captureErrors = VOICE_FLOW_ERRORS[VoiceFlowErrorType.AUDIO_CAPTURE];

describe("Audio capture error handling (IMP-8 / ADR-3)", () => {
  describe("isAudioCaptureSupported", () => {
    const originalNavigator = globalThis.navigator;
    const originalMediaRecorder = globalThis.MediaRecorder;

    afterEach(() => {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, "MediaRecorder", {
        value: originalMediaRecorder,
        writable: true,
        configurable: true,
      });
    });

    it("returns true when getUserMedia and MediaRecorder are available", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          mediaDevices: { getUserMedia: vi.fn() },
        },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, "MediaRecorder", {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });

      expect(isAudioCaptureSupported()).toBe(true);
    });

    it("returns false when navigator.mediaDevices is undefined", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });

      expect(isAudioCaptureSupported()).toBe(false);
    });

    it("returns false when MediaRecorder is undefined", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          mediaDevices: { getUserMedia: vi.fn() },
        },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, "MediaRecorder", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(isAudioCaptureSupported()).toBe(false);
    });
  });

  describe("classifyAudioCaptureError", () => {
    it("returns permissionDenied for NotAllowedError", () => {
      const err = new DOMException("Permission denied", "NotAllowedError");
      const result = classifyAudioCaptureError(err);
      expect(result.code).toBe("AUDIO_CAPTURE_PERMISSION_DENIED");
      expect(result.type).toBe(VoiceFlowErrorType.AUDIO_CAPTURE);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("returns permissionDenied for PermissionDeniedError", () => {
      const err = new DOMException("Permission denied", "PermissionDeniedError");
      const result = classifyAudioCaptureError(err);
      expect(result.code).toBe("AUDIO_CAPTURE_PERMISSION_DENIED");
    });

    it("returns notFound for NotFoundError", () => {
      const err = new DOMException("No device", "NotFoundError");
      const result = classifyAudioCaptureError(err);
      expect(result.code).toBe("AUDIO_CAPTURE_DEVICE_NOT_FOUND");
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("returns notFound for DevicesNotFoundError", () => {
      const err = new DOMException("No device", "DevicesNotFoundError");
      const result = classifyAudioCaptureError(err);
      expect(result.code).toBe("AUDIO_CAPTURE_DEVICE_NOT_FOUND");
    });

    it("returns NOT_READABLE for NotReadableError", () => {
      const err = new DOMException("Device in use", "NotReadableError");
      const result = classifyAudioCaptureError(err);
      expect(result.code).toBe("AUDIO_CAPTURE_NOT_READABLE");
      expect(result.type).toBe(VoiceFlowErrorType.AUDIO_CAPTURE);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("returns notFound for OverconstrainedError", () => {
      const err = new DOMException("Overconstrained", "OverconstrainedError");
      const result = classifyAudioCaptureError(err);
      expect(result.code).toBe("AUDIO_CAPTURE_DEVICE_NOT_FOUND");
    });

    it("returns BROWSER_NOT_SUPPORTED for TypeError", () => {
      const err = new TypeError("getUserMedia is not a function");
      const result = classifyAudioCaptureError(err);
      expect(result.code).toBe("AUDIO_CAPTURE_BROWSER_NOT_SUPPORTED");
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("returns default error for unknown errors", () => {
      const err = new Error("Unknown");
      const result = classifyAudioCaptureError(err);
      expect(result.code).toBe("AUDIO_CAPTURE_FAILED");
      expect(result).toEqual(captureErrors.default);
    });
  });

  describe("requestAudioCapture", () => {
    const originalNavigator = globalThis.navigator;
    const originalMediaRecorder = globalThis.MediaRecorder;

    beforeEach(() => {
      Object.defineProperty(globalThis, "MediaRecorder", {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, "MediaRecorder", {
        value: originalMediaRecorder,
        writable: true,
        configurable: true,
      });
    });

    it("returns ok with stream on success", async () => {
      const mockStream = { getTracks: () => [] };
      Object.defineProperty(globalThis, "navigator", {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue(mockStream),
          },
        },
        writable: true,
        configurable: true,
      });

      const result = await requestAudioCapture();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.stream).toBe(mockStream);
      }
    });

    it("returns error for permission denied", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockRejectedValue(
              new DOMException("Denied", "NotAllowedError")
            ),
          },
        },
        writable: true,
        configurable: true,
      });

      const result = await requestAudioCapture();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUDIO_CAPTURE_PERMISSION_DENIED");
        expect(result.error.message).toContain("refuse");
        expect(result.error.suggestions.length).toBeGreaterThan(0);
      }
    });

    it("returns error for device not found", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockRejectedValue(
              new DOMException("Not found", "NotFoundError")
            ),
          },
        },
        writable: true,
        configurable: true,
      });

      const result = await requestAudioCapture();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUDIO_CAPTURE_DEVICE_NOT_FOUND");
      }
    });

    it("returns browser not supported error when APIs missing", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });

      const result = await requestAudioCapture();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUDIO_CAPTURE_BROWSER_NOT_SUPPORTED");
        expect(result.error.message).toContain("navigateur");
      }
    });

    it("all error results include actionable suggestions", async () => {
      // Test permission denied suggestions
      Object.defineProperty(globalThis, "navigator", {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockRejectedValue(
              new DOMException("Denied", "NotAllowedError")
            ),
          },
        },
        writable: true,
        configurable: true,
      });

      const result = await requestAudioCapture();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.suggestions).toBeInstanceOf(Array);
        expect(result.error.suggestions.length).toBeGreaterThan(0);
        for (const suggestion of result.error.suggestions) {
          expect(typeof suggestion).toBe("string");
          expect(suggestion.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
