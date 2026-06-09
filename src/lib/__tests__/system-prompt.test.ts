import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../system-prompt";

describe("System prompt (ADR-5)", () => {
  it("should contain anti-medical-advice instructions", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("JAMAIS");
    expect(prompt).toContain("conseil medical");
    expect(prompt).toContain("consulter votre medecin");
  });

  it("should contain office information", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Cabinet Medical Fictif");
  });

  it("should list available slots", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Creneaux disponibles");
    expect(prompt).toContain("Dr.");
  });
});
