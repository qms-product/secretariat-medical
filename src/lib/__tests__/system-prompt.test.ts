import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../system-prompt";

describe("System prompt (ADR-5 / IMP-15)", () => {
  const prompt = buildSystemPrompt();

  describe("Interdiction explicite des conseils medicaux", () => {
    it("should contain absolute prohibition of medical advice", () => {
      expect(prompt).toContain("INTERDICTION ABSOLUE");
      expect(prompt).toContain("JAMAIS");
      expect(prompt).toContain("conseil medical");
    });

    it("should forbid diagnosis and treatment recommendations", () => {
      expect(prompt).toContain("diagnostic");
      expect(prompt).toContain("recommandation de traitement");
    });

    it("should forbid symptom evaluation and medication advice", () => {
      expect(prompt).toContain("symptome");
      expect(prompt).toContain("medicament");
      expect(prompt).toContain("posologie");
    });

    it("should forbid interpreting exam results", () => {
      expect(prompt).toContain("resultats d'examens");
    });

    it("should maintain prohibition even if patient insists", () => {
      expect(prompt).toContain("meme si le patient insiste");
    });
  });

  describe("Message de redirection vers professionnels", () => {
    it("should contain a systematic redirection message", () => {
      expect(prompt).toContain("REDIRECTION VERS UN PROFESSIONNEL DE SANTE");
      expect(prompt).toContain("SYSTEMATIQUEMENT");
    });

    it("should redirect to doctor consultation", () => {
      expect(prompt).toContain("consulter votre medecin");
    });

    it("should mention SAMU emergency number", () => {
      expect(prompt).toContain("appeler le 15 (SAMU)");
    });
  });

  describe("Reponses limitees aux informations administratives", () => {
    it("should define administrative-only scope", () => {
      expect(prompt).toContain(
        "INFORMATIONS ADMINISTRATIVES UNIQUEMENT"
      );
    });

    it("should list allowed administrative topics", () => {
      expect(prompt).toContain("Horaires d'ouverture");
      expect(prompt).toContain("Creneaux de rendez-vous");
      expect(prompt).toContain("Coordonnees du cabinet");
      expect(prompt).toContain("Prise de rendez-vous");
    });

    it("should refuse requests outside administrative scope", () => {
      expect(prompt).toContain("refuses poliment toute demande sortant de ce perimetre");
    });
  });

  describe("Configuration appliquee a toutes les requetes", () => {
    it("should return a non-empty string", () => {
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should be deterministic (same output on each call)", () => {
      const prompt2 = buildSystemPrompt();
      expect(prompt).toBe(prompt2);
    });
  });

  describe("Office information included", () => {
    it("should contain office name and contact details", () => {
      expect(prompt).toContain("Cabinet Medical Fictif");
      expect(prompt).toContain("01 23 45 67 89");
    });

    it("should list available appointment slots", () => {
      expect(prompt).toContain("Creneaux disponibles");
      expect(prompt).toContain("Dr.");
    });

    it("should list doctors with their specialties", () => {
      expect(prompt).toContain("Dr. Marie Dupont");
      expect(prompt).toContain("Dr. Jean Martin");
      expect(prompt).toContain("Medecine generale");
      expect(prompt).toContain("Dermatologie");
    });
  });
});
