/**
 * Appointment confirmation formatting for vocal confirmation (IMP-34 / REQ-89).
 * Generates a clear French confirmation message containing:
 * - Appointment date
 * - Appointment time
 * - Practitioner name
 */

import { TIME_SLOTS, type TimeSlot } from "./data";

export interface AppointmentDetails {
  date: string;
  time: string;
  doctor: string;
}

/**
 * French day names indexed by getDay() (0=Sunday).
 */
const JOURS_SEMAINE = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

/**
 * French month names indexed by getMonth() (0=January).
 */
const MOIS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];

/**
 * Formats a date string (YYYY-MM-DD) into a spoken French date.
 * Example: "2026-06-10" → "mercredi 10 juin 2026"
 */
export function formatDateFr(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const jourSemaine = JOURS_SEMAINE[date.getDay()];
  const mois = MOIS[date.getMonth()];
  return `${jourSemaine} ${day} ${mois} ${year}`;
}

/**
 * Formats a time string (HH:MM) into spoken French time.
 * Example: "09:00" → "9 heures"
 * Example: "09:30" → "9 heures 30"
 * Example: "14:00" → "14 heures"
 */
export function formatTimeFr(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":").map(Number);
  if (minutes === 0) {
    return `${hours} heures`;
  }
  return `${hours} heures ${minutes}`;
}

/**
 * Resolves a slot identifier to appointment details.
 * The slot identifier can be:
 * - A slot ID (e.g., "slot-1")
 * - A date+time string (e.g., "2026-06-10 a 09:00 avec Dr. Marie Dupont")
 */
export function resolveSlotDetails(
  slotIdentifier: string,
  slots: TimeSlot[] = TIME_SLOTS
): AppointmentDetails | undefined {
  // Try matching by slot ID
  const slotById = slots.find((s) => s.id === slotIdentifier);
  if (slotById) {
    return { date: slotById.date, time: slotById.time, doctor: slotById.doctor };
  }

  // Try extracting from descriptive string (e.g., "2026-06-10 a 09:00 avec Dr. Marie Dupont")
  const descriptiveMatch = slotIdentifier.match(
    /(\d{4}-\d{2}-\d{2})\s+a\s+(\d{2}:\d{2})\s+avec\s+(.+?)(?:\s*\(|$)/
  );
  if (descriptiveMatch) {
    return {
      date: descriptiveMatch[1],
      time: descriptiveMatch[2],
      doctor: descriptiveMatch[3].trim(),
    };
  }

  // Try matching by date and time within slot data
  const dateMatch = slotIdentifier.match(/(\d{4}-\d{2}-\d{2})/);
  const timeMatch = slotIdentifier.match(/(\d{2}:\d{2})/);
  if (dateMatch && timeMatch) {
    const slotByDateTime = slots.find(
      (s) => s.date === dateMatch[1] && s.time === timeMatch[1]
    );
    if (slotByDateTime) {
      return {
        date: slotByDateTime.date,
        time: slotByDateTime.time,
        doctor: slotByDateTime.doctor,
      };
    }
  }

  return undefined;
}

/**
 * Formats a vocal confirmation message for a successfully created appointment.
 * The message clearly states the date, time, and practitioner name in French.
 *
 * @param details - The appointment date, time, and doctor
 * @returns A French confirmation message suitable for TTS
 */
export function formatAppointmentConfirmation(
  details: AppointmentDetails
): string {
  const dateFr = formatDateFr(details.date);
  const timeFr = formatTimeFr(details.time);

  return `Votre rendez-vous a bien ete enregistre. Il est prevu le ${dateFr} a ${timeFr} avec ${details.doctor}. Nous vous souhaitons une bonne journee.`;
}
