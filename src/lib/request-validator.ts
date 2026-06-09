/**
 * Server-side request validation for IMP-19 / REQ-22.
 * Detects user messages that attempt to book, modify, or cancel appointments.
 * This is a defense-in-depth measure complementing the Claude system prompt.
 */

const APPOINTMENT_ACTION_PATTERNS: RegExp[] = [
  // Booking patterns
  /\b(prendre|reserver|booker|fixer|planifier)\s+(un\s+)?rendez[\s-]?vous\b/i,
  /\b(je\s+)?(veux|voudrais|souhaite|aimerais)\s+(prendre|reserver|fixer)\b/i,
  /\bconfirm(er|e|ez)\s+(le\s+|mon\s+|ce\s+)?rendez[\s-]?vous\b/i,
  // Modification patterns
  /\b(modifier|changer|deplacer|reporter|decaler)\s+(le\s+|mon\s+|un\s+)?rendez[\s-]?vous\b/i,
  // Cancellation patterns
  /\b(annuler|supprimer)\s+(le\s+|mon\s+|un\s+)?rendez[\s-]?vous\b/i,
  // Direct booking imperatives
  /\b(inscri(re|vez|s)[\s-]moi|reserve(z)?[\s-]moi|note(z)?[\s-]moi)\b/i,
  // Slot reservation
  /\b(bloquer|reserver|prendre)\s+(le\s+|ce\s+)?creneau\b/i,
];

/**
 * Returns true if the message contains phrases indicating the user
 * is trying to perform a real appointment action (book, modify, cancel).
 */
export function containsAppointmentAction(message: string): boolean {
  if (typeof message !== "string") return false;
  return APPOINTMENT_ACTION_PATTERNS.some((pattern) => pattern.test(message));
}
