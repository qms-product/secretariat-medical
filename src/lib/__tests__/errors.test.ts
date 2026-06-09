import { describe, it, expect } from "vitest";
import { VoiceFlowError, ERROR_MESSAGES } from "../errors";

describe("Error handling (ADR-3)", () => {
  it("should have error messages for all voice flow steps", () => {
    expect(ERROR_MESSAGES.capture).toBeTruthy();
    expect(ERROR_MESSAGES.transcription).toBeTruthy();
    expect(ERROR_MESSAGES.processing).toBeTruthy();
    expect(ERROR_MESSAGES.synthesis).toBeTruthy();
  });

  it("should create VoiceFlowError with step info", () => {
    const err = new VoiceFlowError("capture", "test error");
    expect(err.step).toBe("capture");
    expect(err.message).toBe("test error");
    expect(err.name).toBe("VoiceFlowError");
  });
});
