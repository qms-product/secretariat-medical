import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  classifyAudioPlaybackError,
  playAudio,
} from "../audio-playback";
import { VoiceFlowErrorType, VOICE_FLOW_ERRORS } from "../errors";

const playbackErrors = VOICE_FLOW_ERRORS[VoiceFlowErrorType.AUDIO_PLAYBACK];

describe("Audio playback (IMP-18 / REQ-14)", () => {
  describe("classifyAudioPlaybackError", () => {
    it("returns decodeError for EncodingError DOMException", () => {
      const err = new DOMException("Unable to decode", "EncodingError");
      const result = classifyAudioPlaybackError(err);
      expect(result.code).toBe("AUDIO_PLAYBACK_DECODE_ERROR");
      expect(result.type).toBe(VoiceFlowErrorType.AUDIO_PLAYBACK);
    });

    it("returns decodeError for InvalidStateError DOMException", () => {
      const err = new DOMException("Invalid state", "InvalidStateError");
      const result = classifyAudioPlaybackError(err);
      expect(result.code).toBe("AUDIO_PLAYBACK_DECODE_ERROR");
    });

    it("returns contextError for NotAllowedError DOMException", () => {
      const err = new DOMException("Autoplay blocked", "NotAllowedError");
      const result = classifyAudioPlaybackError(err);
      expect(result.code).toBe("AUDIO_PLAYBACK_CONTEXT_ERROR");
      expect(result.type).toBe(VoiceFlowErrorType.AUDIO_PLAYBACK);
    });

    it("returns decodeError for errors mentioning decode", () => {
      const err = new Error("Failed to decode audio data");
      const result = classifyAudioPlaybackError(err);
      expect(result.code).toBe("AUDIO_PLAYBACK_DECODE_ERROR");
    });

    it("returns default error for unknown errors", () => {
      const err = new Error("Something went wrong");
      const result = classifyAudioPlaybackError(err);
      expect(result.code).toBe("AUDIO_PLAYBACK_FAILED");
      expect(result).toEqual(playbackErrors.default);
    });

    it("all error variants include actionable suggestions", () => {
      const errors = [
        classifyAudioPlaybackError(new DOMException("", "EncodingError")),
        classifyAudioPlaybackError(new DOMException("", "NotAllowedError")),
        classifyAudioPlaybackError(new Error("unknown")),
      ];
      for (const error of errors) {
        expect(error.suggestions).toBeInstanceOf(Array);
        expect(error.suggestions.length).toBeGreaterThan(0);
        for (const suggestion of error.suggestions) {
          expect(typeof suggestion).toBe("string");
          expect(suggestion.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("playAudio", () => {
    const originalAudioContext = globalThis.AudioContext;
    let mockClose: ReturnType<typeof vi.fn>;
    let mockResume: ReturnType<typeof vi.fn>;
    let mockDecodeAudioData: ReturnType<typeof vi.fn>;
    let mockCreateGain: ReturnType<typeof vi.fn>;
    let mockCreateBufferSource: ReturnType<typeof vi.fn>;
    let mockGainNode: { gain: { value: number }; connect: ReturnType<typeof vi.fn> };
    let mockSource: {
      buffer: null | object;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      onended: (() => void) | null;
    };

    beforeEach(() => {
      mockClose = vi.fn().mockResolvedValue(undefined);
      mockResume = vi.fn().mockResolvedValue(undefined);
      mockGainNode = {
        gain: { value: 0 },
        connect: vi.fn(),
      };
      mockSource = {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn().mockImplementation(function (this: typeof mockSource) {
          // Simulate immediate playback end
          setTimeout(() => this.onended?.(), 0);
        }),
        onended: null,
      };
      mockDecodeAudioData = vi.fn().mockResolvedValue({ duration: 1 });
      mockCreateGain = vi.fn().mockReturnValue(mockGainNode);
      mockCreateBufferSource = vi.fn().mockReturnValue(mockSource);

      Object.defineProperty(globalThis, "AudioContext", {
        value: vi.fn().mockImplementation(() => ({
          state: "running",
          resume: mockResume,
          close: mockClose,
          destination: {},
          decodeAudioData: mockDecodeAudioData,
          createGain: mockCreateGain,
          createBufferSource: mockCreateBufferSource,
        })),
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis, "AudioContext", {
        value: originalAudioContext,
        writable: true,
        configurable: true,
      });
    });

    it("plays audio successfully and returns ok", async () => {
      const audioData = new ArrayBuffer(100);
      const result = await playAudio(audioData);
      expect(result.ok).toBe(true);
      expect(mockDecodeAudioData).toHaveBeenCalledWith(audioData);
      expect(mockSource.start).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });

    it("uses GainNode with default volume of 1.0", async () => {
      const audioData = new ArrayBuffer(100);
      await playAudio(audioData);
      expect(mockCreateGain).toHaveBeenCalled();
      expect(mockGainNode.gain.value).toBe(1.0);
      expect(mockGainNode.connect).toHaveBeenCalled();
      expect(mockSource.connect).toHaveBeenCalledWith(mockGainNode);
    });

    it("accepts a custom volume parameter", async () => {
      const audioData = new ArrayBuffer(100);
      await playAudio(audioData, 0.5);
      expect(mockGainNode.gain.value).toBe(0.5);
    });

    it("clamps volume between 0 and 1", async () => {
      const audioData = new ArrayBuffer(100);

      await playAudio(audioData, 1.5);
      expect(mockGainNode.gain.value).toBe(1);

      await playAudio(audioData, -0.5);
      expect(mockGainNode.gain.value).toBe(0);
    });

    it("resumes suspended AudioContext", async () => {
      Object.defineProperty(globalThis, "AudioContext", {
        value: vi.fn().mockImplementation(() => ({
          state: "suspended",
          resume: mockResume,
          close: mockClose,
          destination: {},
          decodeAudioData: mockDecodeAudioData,
          createGain: mockCreateGain,
          createBufferSource: mockCreateBufferSource,
        })),
        writable: true,
        configurable: true,
      });

      const audioData = new ArrayBuffer(100);
      await playAudio(audioData);
      expect(mockResume).toHaveBeenCalled();
    });

    it("returns decode error when decodeAudioData fails", async () => {
      mockDecodeAudioData.mockRejectedValue(
        new DOMException("Unable to decode", "EncodingError")
      );

      const audioData = new ArrayBuffer(100);
      const result = await playAudio(audioData);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUDIO_PLAYBACK_DECODE_ERROR");
        expect(result.error.type).toBe(VoiceFlowErrorType.AUDIO_PLAYBACK);
      }
    });

    it("returns context error when AudioContext is blocked", async () => {
      Object.defineProperty(globalThis, "AudioContext", {
        value: vi.fn().mockImplementation(() => ({
          state: "suspended",
          resume: vi.fn().mockRejectedValue(
            new DOMException("Autoplay blocked", "NotAllowedError")
          ),
          close: mockClose,
          destination: {},
        })),
        writable: true,
        configurable: true,
      });

      const audioData = new ArrayBuffer(100);
      const result = await playAudio(audioData);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUDIO_PLAYBACK_CONTEXT_ERROR");
      }
    });

    it("returns default error for unexpected failures", async () => {
      mockDecodeAudioData.mockRejectedValue(new Error("Unknown error"));

      const audioData = new ArrayBuffer(100);
      const result = await playAudio(audioData);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUDIO_PLAYBACK_FAILED");
      }
    });

    it("closes AudioContext even on error", async () => {
      mockDecodeAudioData.mockRejectedValue(new Error("fail"));

      const audioData = new ArrayBuffer(100);
      await playAudio(audioData);
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
