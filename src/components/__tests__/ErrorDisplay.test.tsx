import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorDisplay } from "../ErrorDisplay";
import { VoiceFlowErrorType, VOICE_FLOW_ERRORS } from "@/lib/errors";

describe("ErrorDisplay (IMP-12 / ADR-3)", () => {
  afterEach(cleanup);

  const defaultProps = {
    error: VOICE_FLOW_ERRORS[VoiceFlowErrorType.AUDIO_CAPTURE].default,
    onRetry: vi.fn(),
    isRetrying: false,
  };

  describe("Step-specific error messages", () => {
    it("displays the correct step label for audio capture errors", () => {
      render(<ErrorDisplay {...defaultProps} />);
      expect(screen.getByTestId("error-step-label")).toHaveTextContent(
        "Erreur — Capture audio"
      );
    });

    it("displays the correct step label for transcription errors", () => {
      render(
        <ErrorDisplay
          {...defaultProps}
          error={VOICE_FLOW_ERRORS[VoiceFlowErrorType.STT_TRANSCRIPTION].default}
        />
      );
      expect(screen.getByTestId("error-step-label")).toHaveTextContent(
        "Erreur — Transcription"
      );
    });

    it("displays the correct step label for processing errors", () => {
      render(
        <ErrorDisplay
          {...defaultProps}
          error={VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING].default}
        />
      );
      expect(screen.getByTestId("error-step-label")).toHaveTextContent(
        "Erreur — Traitement"
      );
    });

    it("displays the correct step label for TTS synthesis errors", () => {
      render(
        <ErrorDisplay
          {...defaultProps}
          error={VOICE_FLOW_ERRORS[VoiceFlowErrorType.TTS_SYNTHESIS].default}
        />
      );
      expect(screen.getByTestId("error-step-label")).toHaveTextContent(
        "Erreur — Synthese vocale"
      );
    });

    it("displays the error message from the error info", () => {
      render(<ErrorDisplay {...defaultProps} />);
      expect(screen.getByTestId("error-message")).toHaveTextContent(
        defaultProps.error.message
      );
    });

    it("displays specific sub-error messages (e.g. permission denied)", () => {
      const permError =
        VOICE_FLOW_ERRORS[VoiceFlowErrorType.AUDIO_CAPTURE].permissionDenied;
      render(<ErrorDisplay {...defaultProps} error={permError} />);
      expect(screen.getByTestId("error-message")).toHaveTextContent(
        permError.message
      );
    });
  });

  describe("Suggestions / resolution instructions", () => {
    it("renders all suggestions from the error info", () => {
      render(<ErrorDisplay {...defaultProps} />);
      const list = screen.getByTestId("error-suggestions");
      const items = list.querySelectorAll("li");
      expect(items).toHaveLength(defaultProps.error.suggestions.length);
      defaultProps.error.suggestions.forEach((suggestion, i) => {
        expect(items[i]).toHaveTextContent(suggestion);
      });
    });

    it("does not render suggestions list when suggestions array is empty", () => {
      const errorNoSuggestions = {
        ...defaultProps.error,
        suggestions: [],
      };
      render(<ErrorDisplay {...defaultProps} error={errorNoSuggestions} />);
      expect(screen.queryByTestId("error-suggestions")).toBeNull();
    });
  });

  describe("Retry button", () => {
    it("renders a retry button", () => {
      render(<ErrorDisplay {...defaultProps} />);
      const button = screen.getByTestId("retry-button");
      expect(button).toHaveTextContent("Reessayer");
    });

    it("calls onRetry when the retry button is clicked", () => {
      const onRetry = vi.fn();
      render(<ErrorDisplay {...defaultProps} onRetry={onRetry} />);
      fireEvent.click(screen.getByTestId("retry-button"));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("shows all four error types with a retry button", () => {
      for (const errorType of Object.values(VoiceFlowErrorType)) {
        const { unmount } = render(
          <ErrorDisplay
            {...defaultProps}
            error={VOICE_FLOW_ERRORS[errorType].default}
          />
        );
        expect(screen.getByTestId("retry-button")).toBeDefined();
        unmount();
      }
    });
  });

  describe("Loading state during retry", () => {
    it("disables the retry button when isRetrying is true", () => {
      render(<ErrorDisplay {...defaultProps} isRetrying={true} />);
      const button = screen.getByTestId("retry-button");
      expect(button).toBeDisabled();
    });

    it("shows loading text when isRetrying is true", () => {
      render(<ErrorDisplay {...defaultProps} isRetrying={true} />);
      expect(screen.getByTestId("retry-button")).toHaveTextContent(
        "Nouvelle tentative en cours..."
      );
    });

    it("enables the retry button when isRetrying is false", () => {
      render(<ErrorDisplay {...defaultProps} isRetrying={false} />);
      const button = screen.getByTestId("retry-button");
      expect(button).not.toBeDisabled();
    });

    it("does not call onRetry when button is clicked during retry", () => {
      const onRetry = vi.fn();
      render(
        <ErrorDisplay {...defaultProps} onRetry={onRetry} isRetrying={true} />
      );
      fireEvent.click(screen.getByTestId("retry-button"));
      expect(onRetry).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has role=alert for screen reader announcement", () => {
      render(<ErrorDisplay {...defaultProps} />);
      expect(screen.getByRole("alert")).toBeDefined();
    });
  });
});
