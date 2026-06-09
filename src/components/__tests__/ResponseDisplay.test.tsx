import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ResponseDisplay } from "../ResponseDisplay";

describe("ResponseDisplay (IMP-17 / REQ-11)", () => {
  afterEach(cleanup);

  describe("Acceptance: Reponse de Claude visible dans l'interface", () => {
    it("renders the response when text is provided", () => {
      render(<ResponseDisplay response="Votre rendez-vous est confirme pour demain." />);
      expect(screen.getByTestId("response-display")).toBeDefined();
    });

    it("does not render when response is empty", () => {
      render(<ResponseDisplay response="" />);
      expect(screen.queryByTestId("response-display")).toBeNull();
    });
  });

  describe("Acceptance: Texte de reponse lisible et formate", () => {
    it("displays the response text content", () => {
      const text = "Votre rendez-vous est confirme pour demain a 14h.";
      render(<ResponseDisplay response={text} />);
      expect(screen.getByTestId("response-text")).toHaveTextContent(text);
    });

    it("displays the 'Assistant' label", () => {
      render(<ResponseDisplay response="test" />);
      expect(screen.getByTestId("response-label")).toHaveTextContent("Assistant");
    });

    it("preserves whitespace in multi-line responses", () => {
      const text = "Premiere ligne\nDeuxieme ligne";
      render(<ResponseDisplay response={text} />);
      const el = screen.getByTestId("response-text");
      expect(el).toHaveTextContent("Premiere ligne");
      expect(el).toHaveTextContent("Deuxieme ligne");
      expect(el).toHaveStyle({ whiteSpace: "pre-wrap" });
    });
  });

  describe("Acceptance: Mise a jour en temps reel", () => {
    it("updates displayed text when response prop changes", () => {
      const { rerender } = render(<ResponseDisplay response="Premiere reponse" />);
      expect(screen.getByTestId("response-text")).toHaveTextContent("Premiere reponse");

      rerender(<ResponseDisplay response="Reponse mise a jour" />);
      expect(screen.getByTestId("response-text")).toHaveTextContent("Reponse mise a jour");
    });

    it("hides component when response becomes empty", () => {
      const { rerender } = render(<ResponseDisplay response="Une reponse" />);
      expect(screen.getByTestId("response-display")).toBeDefined();

      rerender(<ResponseDisplay response="" />);
      expect(screen.queryByTestId("response-display")).toBeNull();
    });
  });

  describe("Accessibilite", () => {
    it("has role=region with appropriate aria-label", () => {
      render(<ResponseDisplay response="test" />);
      const region = screen.getByRole("region", { name: /reponse/i });
      expect(region).toBeDefined();
    });
  });
});
