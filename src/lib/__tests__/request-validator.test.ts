import { describe, it, expect } from "vitest";
import { containsAppointmentAction } from "../request-validator";

describe("Request validator (IMP-19 / REQ-22)", () => {
  describe("Detects appointment booking attempts", () => {
    it.each([
      "Je voudrais prendre rendez-vous avec le Dr Dupont",
      "Prendre un rendez-vous demain matin",
      "Je veux reserver un rendez-vous",
      "Je souhaite fixer un rendez-vous",
      "Confirmez le rendez-vous",
      "Je voudrais confirmer mon rendez-vous",
      "Reservez-moi un creneau",
      "Inscrivez-moi pour demain",
      "Je veux prendre un rendez-vous",
      "Notez-moi pour le creneau de 9h",
      "Bloquer ce creneau pour moi",
      "Planifier un rendez-vous",
    ])("should detect: %s", (message) => {
      expect(containsAppointmentAction(message)).toBe(true);
    });
  });

  describe("Detects appointment modification attempts", () => {
    it.each([
      "Je voudrais modifier mon rendez-vous",
      "Changer le rendez-vous de mardi",
      "Deplacer mon rendez-vous",
      "Reporter le rendez-vous",
      "Decaler un rendez-vous",
    ])("should detect: %s", (message) => {
      expect(containsAppointmentAction(message)).toBe(true);
    });
  });

  describe("Detects appointment cancellation attempts", () => {
    it.each([
      "Annuler mon rendez-vous",
      "Supprimer le rendez-vous de jeudi",
    ])("should detect: %s", (message) => {
      expect(containsAppointmentAction(message)).toBe(true);
    });
  });

  describe("Allows informational queries", () => {
    it.each([
      "Quels sont les creneaux disponibles ?",
      "Quels sont les horaires du cabinet ?",
      "Quel est le numero du Dr Dupont ?",
      "Bonjour, je voudrais des informations",
      "A quelle heure ouvre le cabinet ?",
      "Y a-t-il des creneaux demain ?",
      "Qui sont les medecins du cabinet ?",
      "Quelles sont les specialites disponibles ?",
    ])("should allow: %s", (message) => {
      expect(containsAppointmentAction(message)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string", () => {
      expect(containsAppointmentAction("")).toBe(false);
    });

    it("should handle non-string input", () => {
      expect(containsAppointmentAction(undefined as unknown as string)).toBe(false);
      expect(containsAppointmentAction(null as unknown as string)).toBe(false);
    });
  });
});
