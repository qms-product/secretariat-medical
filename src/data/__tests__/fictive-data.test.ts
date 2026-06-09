import { describe, it, expect } from "vitest";
import {
  PLANNING_FICTIF,
  HORAIRES_CLINIQUE,
  ADRESSE_CLINIQUE,
  SPECIALITES_MEDICALES,
  TARIFS_CONSULTATIONS,
} from "../fictive-data";

describe("Donnees fictives (IMP-5)", () => {
  describe("PLANNING_FICTIF", () => {
    it("contient entre 5 et 10 creneaux (REQ-25, REQ-26)", () => {
      expect(PLANNING_FICTIF.length).toBeGreaterThanOrEqual(5);
      expect(PLANNING_FICTIF.length).toBeLessThanOrEqual(10);
    });

    it("chaque creneau a les champs medecin, date, heure (REQ-24)", () => {
      for (const creneau of PLANNING_FICTIF) {
        expect(creneau.medecin).toBeTruthy();
        expect(creneau.date).toBeTruthy();
        expect(creneau.heure).toBeTruthy();
      }
    });

    it("chaque creneau a un id unique", () => {
      const ids = PLANNING_FICTIF.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("les dates sont au format YYYY-MM-DD", () => {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      for (const creneau of PLANNING_FICTIF) {
        expect(creneau.date).toMatch(dateRegex);
      }
    });

    it("les heures sont au format HH:MM", () => {
      const timeRegex = /^\d{2}:\d{2}$/;
      for (const creneau of PLANNING_FICTIF) {
        expect(creneau.heure).toMatch(timeRegex);
      }
    });

    it("contient au moins un creneau disponible", () => {
      const disponibles = PLANNING_FICTIF.filter((c) => c.disponible);
      expect(disponibles.length).toBeGreaterThan(0);
    });
  });

  describe("HORAIRES_CLINIQUE", () => {
    it("definit les jours de la semaine (REQ-27)", () => {
      const jours = HORAIRES_CLINIQUE.map((h) => h.jour);
      expect(jours).toContain("Lundi");
      expect(jours).toContain("Vendredi");
      expect(jours).toContain("Dimanche");
    });

    it("chaque jour a des heures d'ouverture et fermeture", () => {
      for (const horaire of HORAIRES_CLINIQUE) {
        expect(horaire.jour).toBeTruthy();
        if (!horaire.ferme) {
          expect(horaire.ouverture).toBeTruthy();
          expect(horaire.fermeture).toBeTruthy();
        }
      }
    });
  });

  describe("ADRESSE_CLINIQUE", () => {
    it("contient rue, ville, code postal (REQ-28)", () => {
      expect(ADRESSE_CLINIQUE.rue).toBeTruthy();
      expect(ADRESSE_CLINIQUE.ville).toBeTruthy();
      expect(ADRESSE_CLINIQUE.codePostal).toBeTruthy();
    });

    it("le code postal est un format valide", () => {
      expect(ADRESSE_CLINIQUE.codePostal).toMatch(/^\d{5}$/);
    });
  });

  describe("SPECIALITES_MEDICALES", () => {
    it("liste les specialites disponibles (REQ-29)", () => {
      expect(SPECIALITES_MEDICALES.length).toBeGreaterThan(0);
    });

    it("chaque specialite est une chaine non vide", () => {
      for (const specialite of SPECIALITES_MEDICALES) {
        expect(specialite).toBeTruthy();
        expect(typeof specialite).toBe("string");
      }
    });
  });

  describe("TARIFS_CONSULTATIONS", () => {
    it("associe tarifs aux types de consultations (REQ-30)", () => {
      expect(TARIFS_CONSULTATIONS.length).toBeGreaterThan(0);
    });

    it("chaque tarif a un type et un montant positif", () => {
      for (const tarif of TARIFS_CONSULTATIONS) {
        expect(tarif.type).toBeTruthy();
        expect(tarif.tarif).toBeGreaterThan(0);
      }
    });

    it("les tarifs sont en format monetaire coherent (nombres entiers ou decimaux)", () => {
      for (const tarif of TARIFS_CONSULTATIONS) {
        expect(typeof tarif.tarif).toBe("number");
        expect(Number.isFinite(tarif.tarif)).toBe(true);
      }
    });
  });

  describe("Absence de connexions externes (RSK-5)", () => {
    it("toutes les constantes sont des valeurs statiques", () => {
      expect(Array.isArray(PLANNING_FICTIF)).toBe(true);
      expect(Array.isArray(HORAIRES_CLINIQUE)).toBe(true);
      expect(typeof ADRESSE_CLINIQUE).toBe("object");
      expect(Array.isArray(SPECIALITES_MEDICALES)).toBe(true);
      expect(Array.isArray(TARIFS_CONSULTATIONS)).toBe(true);
    });
  });
});
