import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TranscriptDisplay } from "../TranscriptDisplay";

describe("TranscriptDisplay (IMP-17 / REQ-5)", () => {
  afterEach(cleanup);

  describe("Acceptance: Transcription visible dans l'interface", () => {
    it("renders the transcription when text is provided", () => {
      render(<TranscriptDisplay transcript="Bonjour, je voudrais un rendez-vous" />);
      expect(screen.getByTestId("transcript-display")).toBeDefined();
    });

    it("does not render when transcript is empty", () => {
      render(<TranscriptDisplay transcript="" />);
      expect(screen.queryByTestId("transcript-display")).toBeNull();
    });
  });

  describe("Acceptance: Texte transcrit lisible et formate", () => {
    it("displays the transcript text content", () => {
      const text = "Bonjour, je voudrais un rendez-vous";
      render(<TranscriptDisplay transcript={text} />);
      expect(screen.getByTestId("transcript-text")).toHaveTextContent(text);
    });

    it("displays the 'Vous' label", () => {
      render(<TranscriptDisplay transcript="test" />);
      expect(screen.getByTestId("transcript-label")).toHaveTextContent("Vous");
    });

    it("preserves whitespace in multi-line transcripts", () => {
      const text = "Premiere ligne\nDeuxieme ligne";
      render(<TranscriptDisplay transcript={text} />);
      const el = screen.getByTestId("transcript-text");
      expect(el).toHaveTextContent("Premiere ligne");
      expect(el).toHaveTextContent("Deuxieme ligne");
      expect(el).toHaveStyle({ whiteSpace: "pre-wrap" });
    });
  });

  describe("Acceptance: Mise a jour en temps reel", () => {
    it("updates displayed text when transcript prop changes", () => {
      const { rerender } = render(<TranscriptDisplay transcript="Premier texte" />);
      expect(screen.getByTestId("transcript-text")).toHaveTextContent("Premier texte");

      rerender(<TranscriptDisplay transcript="Texte mis a jour" />);
      expect(screen.getByTestId("transcript-text")).toHaveTextContent("Texte mis a jour");
    });

    it("hides component when transcript becomes empty", () => {
      const { rerender } = render(<TranscriptDisplay transcript="Un texte" />);
      expect(screen.getByTestId("transcript-display")).toBeDefined();

      rerender(<TranscriptDisplay transcript="" />);
      expect(screen.queryByTestId("transcript-display")).toBeNull();
    });
  });

  describe("Accessibilite", () => {
    it("has role=region with appropriate aria-label", () => {
      render(<TranscriptDisplay transcript="test" />);
      const region = screen.getByRole("region", { name: /transcription/i });
      expect(region).toBeDefined();
    });
  });
});
