import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProgressIndicators, type FlowStatus } from "../ProgressIndicators";

describe("ProgressIndicators (IMP-13 / ADR-4)", () => {
  afterEach(cleanup);

  describe("Visibility based on flow status", () => {
    it("does not render when status is idle", () => {
      render(<ProgressIndicators currentStep="idle" />);
      expect(screen.queryByTestId("progress-indicators")).toBeNull();
    });

    it("renders when status is capture", () => {
      render(<ProgressIndicators currentStep="capture" />);
      expect(screen.getByTestId("progress-indicators")).toBeDefined();
    });

    it("renders when status is transcription", () => {
      render(<ProgressIndicators currentStep="transcription" />);
      expect(screen.getByTestId("progress-indicators")).toBeDefined();
    });

    it("renders when status is processing", () => {
      render(<ProgressIndicators currentStep="processing" />);
      expect(screen.getByTestId("progress-indicators")).toBeDefined();
    });

    it("renders when status is synthesis", () => {
      render(<ProgressIndicators currentStep="synthesis" />);
      expect(screen.getByTestId("progress-indicators")).toBeDefined();
    });

    it("renders when status is playing", () => {
      render(<ProgressIndicators currentStep="playing" />);
      expect(screen.getByTestId("progress-indicators")).toBeDefined();
    });
  });

  describe("REQ-31: Microphone indicator during recording", () => {
    it("highlights the capture step when recording", () => {
      render(<ProgressIndicators currentStep="capture" />);
      const step = screen.getByTestId("step-capture");
      expect(step).toHaveAttribute("data-active", "true");
    });

    it("shows the Enregistrement label", () => {
      render(<ProgressIndicators currentStep="capture" />);
      const step = screen.getByTestId("step-capture");
      expect(step).toHaveTextContent("Enregistrement");
    });
  });

  describe("REQ-32: Transcription indicator during STT", () => {
    it("highlights the transcription step during transcription", () => {
      render(<ProgressIndicators currentStep="transcription" />);
      const step = screen.getByTestId("step-transcription");
      expect(step).toHaveAttribute("data-active", "true");
    });

    it("shows the Transcription label", () => {
      render(<ProgressIndicators currentStep="transcription" />);
      const step = screen.getByTestId("step-transcription");
      expect(step).toHaveTextContent("Transcription");
    });

    it("marks capture step as completed during transcription", () => {
      render(<ProgressIndicators currentStep="transcription" />);
      const step = screen.getByTestId("step-capture");
      expect(step).toHaveAttribute("data-completed", "true");
    });
  });

  describe("REQ-33: Thinking indicator during Claude processing", () => {
    it("highlights the processing step during processing", () => {
      render(<ProgressIndicators currentStep="processing" />);
      const step = screen.getByTestId("step-processing");
      expect(step).toHaveAttribute("data-active", "true");
    });

    it("shows the Reflexion label", () => {
      render(<ProgressIndicators currentStep="processing" />);
      const step = screen.getByTestId("step-processing");
      expect(step).toHaveTextContent("Reflexion");
    });

    it("marks previous steps as completed during processing", () => {
      render(<ProgressIndicators currentStep="processing" />);
      expect(screen.getByTestId("step-capture")).toHaveAttribute("data-completed", "true");
      expect(screen.getByTestId("step-transcription")).toHaveAttribute("data-completed", "true");
    });
  });

  describe("REQ-34: Playback indicator during audio playback", () => {
    it("highlights the playing step during synthesis", () => {
      render(<ProgressIndicators currentStep="synthesis" />);
      const step = screen.getByTestId("step-playing");
      expect(step).toHaveAttribute("data-active", "true");
    });

    it("highlights the playing step during playback", () => {
      render(<ProgressIndicators currentStep="playing" />);
      const step = screen.getByTestId("step-playing");
      expect(step).toHaveAttribute("data-active", "true");
    });

    it("shows the Lecture label", () => {
      render(<ProgressIndicators currentStep="playing" />);
      const step = screen.getByTestId("step-playing");
      expect(step).toHaveTextContent("Lecture");
    });

    it("marks all previous steps as completed during playback", () => {
      render(<ProgressIndicators currentStep="playing" />);
      expect(screen.getByTestId("step-capture")).toHaveAttribute("data-completed", "true");
      expect(screen.getByTestId("step-transcription")).toHaveAttribute("data-completed", "true");
      expect(screen.getByTestId("step-processing")).toHaveAttribute("data-completed", "true");
    });
  });

  describe("Only active step is highlighted", () => {
    const testCases: { step: FlowStatus; activeKey: string }[] = [
      { step: "capture", activeKey: "step-capture" },
      { step: "transcription", activeKey: "step-transcription" },
      { step: "processing", activeKey: "step-processing" },
      { step: "playing", activeKey: "step-playing" },
    ];

    const allStepKeys = ["step-capture", "step-transcription", "step-processing", "step-playing"];

    testCases.forEach(({ step, activeKey }) => {
      it(`only ${activeKey} is active when status is ${step}`, () => {
        render(<ProgressIndicators currentStep={step} />);
        allStepKeys.forEach((key) => {
          const el = screen.getByTestId(key);
          if (key === activeKey) {
            expect(el).toHaveAttribute("data-active", "true");
          } else {
            expect(el).toHaveAttribute("data-active", "false");
          }
        });
      });
    });
  });

  describe("All four steps are displayed", () => {
    it("renders all four step indicators", () => {
      render(<ProgressIndicators currentStep="capture" />);
      expect(screen.getByTestId("step-capture")).toBeDefined();
      expect(screen.getByTestId("step-transcription")).toBeDefined();
      expect(screen.getByTestId("step-processing")).toBeDefined();
      expect(screen.getByTestId("step-playing")).toBeDefined();
    });
  });

  describe("Accessibility", () => {
    it("has role=status for screen reader announcement", () => {
      render(<ProgressIndicators currentStep="capture" />);
      expect(screen.getByRole("status")).toBeDefined();
    });

    it("has an accessible label describing the progress", () => {
      render(<ProgressIndicators currentStep="capture" />);
      expect(screen.getByRole("status")).toHaveAttribute(
        "aria-label",
        "Progression du flux vocal"
      );
    });
  });
});
