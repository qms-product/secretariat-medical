/**
 * Error types for each step of the voice flow per ADR-3.
 */

export type VoiceFlowStep = "capture" | "transcription" | "processing" | "synthesis";

export class VoiceFlowError extends Error {
  constructor(
    public readonly step: VoiceFlowStep,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "VoiceFlowError";
  }
}

export const ERROR_MESSAGES: Record<VoiceFlowStep, string> = {
  capture:
    "Erreur lors de la capture audio. Verifiez que votre microphone est autorise et fonctionne correctement.",
  transcription:
    "Erreur lors de la transcription. Le service de reconnaissance vocale est temporairement indisponible.",
  processing:
    "Erreur lors du traitement de votre demande. Le service de traitement est temporairement indisponible.",
  synthesis:
    "Erreur lors de la synthese vocale. Le service de synthese est temporairement indisponible.",
};
