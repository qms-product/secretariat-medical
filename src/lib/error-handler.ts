/**
 * ErrorHandlerService — Transforms Cal.com exceptions into contextual
 * French vocal messages to maintain the conversational experience.
 *
 * Per IMP-26 / ADR-9:
 * - Timeout → apology message
 * - 4xx → guidance message
 * - 5xx → suggest calling back later
 * - No slots → informative message
 * All messages maintain a conversational tone in French.
 */

import { CalcomApiError, CalcomTimeoutError } from "./calcom";

/** Represents a vocal error response ready for TTS synthesis. */
export interface VocalErrorResponse {
  /** The category of Cal.com error that was handled */
  errorType: "timeout" | "client_error" | "server_error" | "no_slots";
  /** Conversational French message suitable for TTS */
  vocalMessage: string;
}

/** Vocal messages for each error type — conversational tone in French. */
const VOCAL_MESSAGES: Record<VocalErrorResponse["errorType"], string> = {
  timeout:
    "Je suis desole, le service de rendez-vous met un peu trop de temps a repondre. Pourriez-vous reessayer dans quelques instants, s'il vous plait ?",
  client_error:
    "Je suis desole, il semble y avoir un souci avec les informations transmises. Pourriez-vous verifier vos informations et reessayer, s'il vous plait ?",
  server_error:
    "Je suis desole, le service de rendez-vous rencontre actuellement un probleme technique. Je vous conseille de rappeler un peu plus tard.",
  no_slots:
    "Je suis desole, il n'y a malheureusement aucun creneau disponible pour le moment. Je vous invite a rappeler ulterieurement pour verifier les nouvelles disponibilites.",
};

/**
 * Handles a Cal.com error and returns a vocal response suitable for TTS.
 *
 * @param error - A CalcomApiError, CalcomTimeoutError, or other Error from Cal.com calls
 * @returns A VocalErrorResponse with the appropriate conversational message
 */
export function handleCalcomError(error: unknown): VocalErrorResponse {
  if (error instanceof CalcomTimeoutError) {
    return {
      errorType: "timeout",
      vocalMessage: VOCAL_MESSAGES.timeout,
    };
  }

  if (error instanceof CalcomApiError) {
    if (error.status >= 400 && error.status < 500) {
      return {
        errorType: "client_error",
        vocalMessage: VOCAL_MESSAGES.client_error,
      };
    }

    if (error.status >= 500) {
      return {
        errorType: "server_error",
        vocalMessage: VOCAL_MESSAGES.server_error,
      };
    }
  }

  // Fallback: treat unknown errors as server errors
  return {
    errorType: "server_error",
    vocalMessage: VOCAL_MESSAGES.server_error,
  };
}

/**
 * Generates a vocal response for when no slots are available.
 * This is not an error per se, but needs a conversational vocal response.
 *
 * @returns A VocalErrorResponse for the no-slots case
 */
export function handleNoSlotsAvailable(): VocalErrorResponse {
  return {
    errorType: "no_slots",
    vocalMessage: VOCAL_MESSAGES.no_slots,
  };
}

/**
 * Returns the vocal message string for a given error type.
 * Utility for cases where only the message text is needed.
 */
export function getVocalMessage(
  errorType: VocalErrorResponse["errorType"]
): string {
  return VOCAL_MESSAGES[errorType];
}
