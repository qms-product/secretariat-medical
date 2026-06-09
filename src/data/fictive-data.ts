/**
 * DONNEES FICTIVES — Ce fichier contient exclusivement des donnees fictives
 * pour l'assistant vocal de secretariat medical.
 *
 * Aucune donnee reelle de patient n'est utilisee (ADR-2, REQ-21).
 * Toutes les constantes sont statiques et codees en dur — aucune connexion
 * externe ou import de donnees dynamiques.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Creneau de planning fictif (REQ-24) */
export interface CreneauPlanning {
  id: string;
  medecin: string;
  date: string; // format YYYY-MM-DD
  heure: string; // format HH:MM
  duree: number; // minutes
  disponible: boolean;
  nomPatient?: string;
}

/** Horaires d'ouverture par jour (REQ-27) */
export interface HorairesOuverture {
  jour: string;
  ouverture: string; // format HH:MM
  fermeture: string; // format HH:MM
  ferme: boolean;
}

/** Adresse postale de la clinique (REQ-28) */
export interface AdresseClinique {
  rue: string;
  ville: string;
  codePostal: string;
}

/** Tarif associe a un type de consultation (REQ-30) */
export interface TarifConsultation {
  type: string;
  tarif: number; // euros
}

// ---------------------------------------------------------------------------
// Constantes fictives
// ---------------------------------------------------------------------------

/**
 * DONNEES FICTIVES — Planning fictif avec 8 creneaux (REQ-25: min 5, REQ-26: max 10).
 * Les noms de medecins, dates et patients sont entierement inventes.
 */
export const PLANNING_FICTIF: CreneauPlanning[] = [
  {
    id: "creneau-1",
    medecin: "Dr. Marie Dupont",
    date: "2026-06-10",
    heure: "09:00",
    duree: 30,
    disponible: true,
  },
  {
    id: "creneau-2",
    medecin: "Dr. Marie Dupont",
    date: "2026-06-10",
    heure: "10:00",
    duree: 30,
    disponible: false,
    nomPatient: "Jean Leclerc",
  },
  {
    id: "creneau-3",
    medecin: "Dr. Marie Dupont",
    date: "2026-06-10",
    heure: "11:00",
    duree: 30,
    disponible: true,
  },
  {
    id: "creneau-4",
    medecin: "Dr. Jean Martin",
    date: "2026-06-10",
    heure: "14:00",
    duree: 30,
    disponible: true,
  },
  {
    id: "creneau-5",
    medecin: "Dr. Jean Martin",
    date: "2026-06-10",
    heure: "15:00",
    duree: 30,
    disponible: false,
    nomPatient: "Sophie Bernard",
  },
  {
    id: "creneau-6",
    medecin: "Dr. Marie Dupont",
    date: "2026-06-11",
    heure: "09:30",
    duree: 30,
    disponible: true,
  },
  {
    id: "creneau-7",
    medecin: "Dr. Jean Martin",
    date: "2026-06-11",
    heure: "14:00",
    duree: 30,
    disponible: false,
    nomPatient: "Pierre Moreau",
  },
  {
    id: "creneau-8",
    medecin: "Dr. Marie Dupont",
    date: "2026-06-12",
    heure: "09:00",
    duree: 30,
    disponible: true,
  },
];

/**
 * DONNEES FICTIVES — Horaires d'ouverture de la clinique (REQ-27).
 */
export const HORAIRES_CLINIQUE: HorairesOuverture[] = [
  { jour: "Lundi", ouverture: "08:00", fermeture: "18:00", ferme: false },
  { jour: "Mardi", ouverture: "08:00", fermeture: "18:00", ferme: false },
  { jour: "Mercredi", ouverture: "08:00", fermeture: "18:00", ferme: false },
  { jour: "Jeudi", ouverture: "08:00", fermeture: "18:00", ferme: false },
  { jour: "Vendredi", ouverture: "08:00", fermeture: "18:00", ferme: false },
  { jour: "Samedi", ouverture: "09:00", fermeture: "12:00", ferme: false },
  { jour: "Dimanche", ouverture: "", fermeture: "", ferme: true },
];

/**
 * DONNEES FICTIVES — Adresse de la clinique (REQ-28).
 */
export const ADRESSE_CLINIQUE: AdresseClinique = {
  rue: "12 Rue de la Sante",
  ville: "Paris",
  codePostal: "75014",
};

/**
 * DONNEES FICTIVES — Specialites medicales disponibles (REQ-29).
 */
export const SPECIALITES_MEDICALES: string[] = [
  "Medecine generale",
  "Dermatologie",
  "Cardiologie",
  "Pediatrie",
  "Ophtalmologie",
];

/**
 * DONNEES FICTIVES — Tarifs des consultations (REQ-30).
 */
export const TARIFS_CONSULTATIONS: TarifConsultation[] = [
  { type: "Consultation generale", tarif: 25 },
  { type: "Consultation specialiste", tarif: 50 },
  { type: "Consultation urgente", tarif: 60 },
  { type: "Consultation de suivi", tarif: 25 },
  { type: "Consultation pediatrique", tarif: 30 },
];
