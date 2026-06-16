/**
 * Server-side validation for patient data (ADR-9, IMP-27).
 *
 * Validates email (RFC 5322 simplified) and French phone number formats
 * before creating Cal.com bookings. Returns conversational error messages
 * in French for voice assistant correction flow.
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validates an email address using a simplified RFC 5322 pattern.
 * Accepts standard email formats: local@domain.tld
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  // Simplified RFC 5322: local part allows alphanumeric, dots, hyphens, underscores, plus signs
  // Domain part allows alphanumeric and hyphens, with at least one dot and a 2+ char TLD
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates a French phone number.
 *
 * Accepted formats:
 * - 01-05: Landline (geographic)
 * - 06-07: Mobile
 * - 08-09: Special / premium
 *
 * Accepts with or without:
 * - International prefix: +33 or 0033
 * - Spaces, dots, or hyphens as separators
 * - Leading 0
 *
 * Examples of valid numbers:
 *   06 12 34 56 78
 *   0612345678
 *   +33 6 12 34 56 78
 *   +33612345678
 *   0033 6 12 34 56 78
 *   01.23.45.67.89
 *   01-23-45-67-89
 */
export function isValidFrenchPhone(phone: string): boolean {
  if (typeof phone !== "string") return false;

  // Normalize: remove spaces, dots, hyphens, and parentheses
  const cleaned = phone.trim().replace(/[\s.\-()]/g, "");

  // French number with international prefix +33 or 0033
  // After prefix, first digit is 1-9 (no leading 0), then 8 more digits = 9 digits total
  const internationalRegex = /^(?:\+33|0033)[1-9]\d{8}$/;

  // French number with leading 0: 0[1-9] followed by 8 digits = 10 digits total
  const nationalRegex = /^0[1-9]\d{8}$/;

  return internationalRegex.test(cleaned) || nationalRegex.test(cleaned);
}

/**
 * Validates patient email with a conversational French error message.
 */
export function validateEmail(email: string | undefined): ValidationError | null {
  if (!email || typeof email !== "string" || email.trim() === "") {
    return {
      field: "email",
      message: "L'adresse email est requise pour confirmer le rendez-vous.",
    };
  }

  if (!isValidEmail(email)) {
    return {
      field: "email",
      message:
        "L'adresse email semble invalide. Pourriez-vous la repeter ? Elle doit etre au format nom@exemple.fr.",
    };
  }

  return null;
}

/**
 * Validates patient phone number with a conversational French error message.
 */
export function validatePhone(phone: string | undefined): ValidationError | null {
  if (phone === undefined || phone === null) {
    // Phone is optional
    return null;
  }

  if (typeof phone !== "string") {
    return {
      field: "phone",
      message: "Le numero de telephone doit etre une chaine de caracteres.",
    };
  }

  if (phone.trim() === "") {
    // Empty string treated as not provided (optional)
    return null;
  }

  if (!isValidFrenchPhone(phone)) {
    return {
      field: "phone",
      message:
        "Le numero de telephone semble invalide. Pourriez-vous le repeter ? Il doit etre un numero francais a 10 chiffres, par exemple 06 12 34 56 78.",
    };
  }

  return null;
}

/**
 * Validates all patient contact data for booking.
 * Returns a ValidationResult with all errors collected.
 */
export function validatePatientData(data: {
  email?: string;
  phone?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  const emailError = validateEmail(data.email);
  if (emailError) errors.push(emailError);

  const phoneError = validatePhone(data.phone);
  if (phoneError) errors.push(phoneError);

  return {
    valid: errors.length === 0,
    errors,
  };
}
