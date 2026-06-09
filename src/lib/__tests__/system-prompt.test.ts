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

  describe("Interdiction prise de rendez-vous et modification de planning (IMP-19 / REQ-22)", () => {
    it("should contain absolute prohibition of appointment booking", () => {
      expect(prompt).toContain("INTERDICTION ABSOLUE");
      expect(prompt).toContain("PRISE DE RENDEZ-VOUS ET MODIFICATION DE PLANNING");
    });

    it("should forbid real appointment booking", () => {
      expect(prompt).toContain("ne prends JAMAIS de rendez-vous reel");
    });

    it("should forbid confirming reservations", () => {
      expect(prompt).toContain("ne confirmes JAMAIS une reservation");
    });

    it("should forbid modifying schedules", () => {
      expect(prompt).toContain("ne modifies JAMAIS un planning");
    });

    it("should forbid simulating appointment booking", () => {
      expect(prompt).toContain("ne dois JAMAIS simuler une prise de rendez-vous");
    });

    it("should provide a redirection message for appointment requests", () => {
      expect(prompt).toContain("Je ne suis pas en mesure de prendre ou modifier des rendez-vous");
      expect(prompt).toContain("contacter le cabinet");
    });

    it("should explicitly state responses are informational only", () => {
      expect(prompt).toContain("assistant purement informatif");
      expect(prompt).toContain("Aucune action reelle");
    });

    it("should not include appointment booking in allowed scope", () => {
      expect(prompt).not.toContain("- Prise de rendez-vous");
    });

    it("should specify slots are consultation-only, no reservation", () => {
      expect(prompt).toContain("consultation uniquement, sans reservation");
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
