/**
 * Error types for each step of the voice flow per ADR-3 / IMP-7.
 *
 * Provides granular error identification with contextual messages
 * and resolution suggestions for each voice flow step.
 */

/** Enum identifying which step of the voice flow failed. */
export enum VoiceFlowErrorType {
  AUDIO_CAPTURE = "AUDIO_CAPTURE",
  STT_TRANSCRIPTION = "STT_TRANSCRIPTION",
  CLAUDE_PROCESSING = "CLAUDE_PROCESSING",
  TTS_SYNTHESIS = "TTS_SYNTHESIS",
  AUDIO_PLAYBACK = "AUDIO_PLAYBACK",
}

/** Structured error object with code, message and resolution suggestions. */
export interface VoiceFlowErrorInfo {
  /** Error type identifying the failed step */
  type: VoiceFlowErrorType;
  /** Machine-readable error code (e.g. "AUDIO_CAPTURE_PERMISSION_DENIED") */
  code: string;
  /** User-facing error message in French */
  message: string;
  /** Actionable suggestions to resolve the error */
  suggestions: string[];
}

/** Legacy step type kept for frontend compatibility. */
export type VoiceFlowStep =
  | "capture"
  | "transcription"
  | "processing"
  | "synthesis"
  | "playing";

/** Maps VoiceFlowErrorType to the corresponding VoiceFlowStep. */
export const ERROR_TYPE_TO_STEP: Record<VoiceFlowErrorType, VoiceFlowStep> = {
  [VoiceFlowErrorType.AUDIO_CAPTURE]: "capture",
  [VoiceFlowErrorType.STT_TRANSCRIPTION]: "transcription",
  [VoiceFlowErrorType.CLAUDE_PROCESSING]: "processing",
  [VoiceFlowErrorType.TTS_SYNTHESIS]: "synthesis",
  [VoiceFlowErrorType.AUDIO_PLAYBACK]: "playing",
};

export class VoiceFlowError extends Error {
  public readonly errorInfo: VoiceFlowErrorInfo;

  constructor(
    public readonly step: VoiceFlowStep,
    message: string,
    public readonly cause?: unknown,
    errorInfo?: VoiceFlowErrorInfo
  ) {
    super(message);
    this.name = "VoiceFlowError";
    this.errorInfo =
      errorInfo ?? VOICE_FLOW_ERRORS[stepToErrorType(step)].default;
  }

  /** Create a VoiceFlowError from a VoiceFlowErrorInfo. */
  static fromErrorInfo(
    info: VoiceFlowErrorInfo,
    cause?: unknown
  ): VoiceFlowError {
    return new VoiceFlowError(
      ERROR_TYPE_TO_STEP[info.type],
      info.message,
      cause,
      info
    );
  }
}

function stepToErrorType(step: VoiceFlowStep): VoiceFlowErrorType {
  const map: Record<VoiceFlowStep, VoiceFlowErrorType> = {
    capture: VoiceFlowErrorType.AUDIO_CAPTURE,
    transcription: VoiceFlowErrorType.STT_TRANSCRIPTION,
    processing: VoiceFlowErrorType.CLAUDE_PROCESSING,
    synthesis: VoiceFlowErrorType.TTS_SYNTHESIS,
    playing: VoiceFlowErrorType.AUDIO_PLAYBACK,
  };
  return map[step];
}

/** Pre-defined error info objects for each voice flow step. */
export const VOICE_FLOW_ERRORS: Record<
  VoiceFlowErrorType,
  Record<string, VoiceFlowErrorInfo>
> = {
  [VoiceFlowErrorType.AUDIO_CAPTURE]: {
    default: {
      type: VoiceFlowErrorType.AUDIO_CAPTURE,
      code: "AUDIO_CAPTURE_FAILED",
      message:
        "Erreur lors de la capture audio. Verifiez que votre microphone est autorise et fonctionne correctement.",
      suggestions: [
        "Verifiez que votre microphone est branche",
        "Autorisez l'acces au microphone dans les parametres du navigateur",
        "Essayez de recharger la page",
      ],
    },
    permissionDenied: {
      type: VoiceFlowErrorType.AUDIO_CAPTURE,
      code: "AUDIO_CAPTURE_PERMISSION_DENIED",
      message:
        "L'acces au microphone a ete refuse. Veuillez autoriser l'acces au microphone pour utiliser l'assistant vocal.",
      suggestions: [
        "Cliquez sur l'icone de cadenas dans la barre d'adresse",
        "Autorisez l'acces au microphone",
        "Rechargez la page apres avoir modifie les permissions",
      ],
    },
    notFound: {
      type: VoiceFlowErrorType.AUDIO_CAPTURE,
      code: "AUDIO_CAPTURE_DEVICE_NOT_FOUND",
      message:
        "Aucun microphone detecte. Veuillez brancher un microphone et reessayer.",
      suggestions: [
        "Branchez un microphone ou un casque avec microphone",
        "Verifiez que votre microphone est reconnu par le systeme",
      ],
    },
  },
  [VoiceFlowErrorType.STT_TRANSCRIPTION]: {
    default: {
      type: VoiceFlowErrorType.STT_TRANSCRIPTION,
      code: "STT_TRANSCRIPTION_FAILED",
      message:
        "Erreur lors de la transcription. Le service de reconnaissance vocale est temporairement indisponible.",
      suggestions: [
        "Reessayez dans quelques instants",
        "Verifiez votre connexion internet",
      ],
    },
    timeout: {
      type: VoiceFlowErrorType.STT_TRANSCRIPTION,
      code: "STT_TRANSCRIPTION_TIMEOUT",
      message:
        "La transcription a pris trop de temps. Le service de reconnaissance vocale ne repond pas.",
      suggestions: [
        "Reessayez avec un enregistrement plus court",
        "Verifiez votre connexion internet",
      ],
    },
    quota: {
      type: VoiceFlowErrorType.STT_TRANSCRIPTION,
      code: "STT_TRANSCRIPTION_QUOTA_EXCEEDED",
      message:
        "Le quota du service de transcription est atteint. Le service est temporairement limite.",
      suggestions: [
        "Reessayez dans quelques minutes",
        "Contactez l'administrateur si le probleme persiste",
      ],
    },
    audioFormat: {
      type: VoiceFlowErrorType.STT_TRANSCRIPTION,
      code: "STT_TRANSCRIPTION_AUDIO_FORMAT",
      message:
        "Le format audio n'est pas pris en charge par le service de transcription.",
      suggestions: [
        "Verifiez que votre microphone fonctionne correctement",
        "Essayez avec un autre navigateur",
      ],
    },
    serviceUnavailable: {
      type: VoiceFlowErrorType.STT_TRANSCRIPTION,
      code: "STT_TRANSCRIPTION_SERVICE_UNAVAILABLE",
      message:
        "Le service de transcription est actuellement indisponible. Veuillez reessayer ulterieurement.",
      suggestions: [
        "Reessayez dans quelques minutes",
        "Verifiez votre connexion internet",
      ],
    },
  },
  [VoiceFlowErrorType.CLAUDE_PROCESSING]: {
    default: {
      type: VoiceFlowErrorType.CLAUDE_PROCESSING,
      code: "CLAUDE_PROCESSING_FAILED",
      message:
        "Erreur lors du traitement de votre demande. Le service de traitement est temporairement indisponible.",
      suggestions: [
        "Reessayez dans quelques instants",
        "Reformulez votre demande si le probleme persiste",
      ],
    },
    timeout: {
      type: VoiceFlowErrorType.CLAUDE_PROCESSING,
      code: "CLAUDE_PROCESSING_TIMEOUT",
      message:
        "Le traitement de votre demande a pris trop de temps. Le service ne repond pas.",
      suggestions: [
        "Reessayez dans quelques instants",
        "Essayez une demande plus courte",
      ],
    },
    quota: {
      type: VoiceFlowErrorType.CLAUDE_PROCESSING,
      code: "CLAUDE_PROCESSING_QUOTA_EXCEEDED",
      message:
        "Le quota du service de traitement est atteint. Le service est temporairement limite.",
      suggestions: [
        "Reessayez dans quelques minutes",
        "Contactez l'administrateur si le probleme persiste",
      ],
    },
    contentFiltered: {
      type: VoiceFlowErrorType.CLAUDE_PROCESSING,
      code: "CLAUDE_PROCESSING_CONTENT_FILTERED",
      message:
        "Votre demande n'a pas pu etre traitee car elle contient du contenu inapproprie.",
      suggestions: [
        "Reformulez votre demande",
        "Limitez-vous aux questions administratives du cabinet",
      ],
    },
    serviceUnavailable: {
      type: VoiceFlowErrorType.CLAUDE_PROCESSING,
      code: "CLAUDE_PROCESSING_SERVICE_UNAVAILABLE",
      message:
        "Le service de traitement est actuellement indisponible. Veuillez reessayer ulterieurement.",
      suggestions: [
        "Reessayez dans quelques minutes",
        "Verifiez votre connexion internet",
      ],
    },
  },
  [VoiceFlowErrorType.TTS_SYNTHESIS]: {
    default: {
      type: VoiceFlowErrorType.TTS_SYNTHESIS,
      code: "TTS_SYNTHESIS_FAILED",
      message:
        "Erreur lors de la synthese vocale. Le service de synthese est temporairement indisponible.",
      suggestions: [
        "Reessayez dans quelques instants",
        "La reponse textuelle reste disponible ci-dessus",
      ],
    },
    timeout: {
      type: VoiceFlowErrorType.TTS_SYNTHESIS,
      code: "TTS_SYNTHESIS_TIMEOUT",
      message:
        "La synthese vocale a pris trop de temps. Le service ne repond pas.",
      suggestions: [
        "Reessayez dans quelques instants",
        "La reponse textuelle reste disponible ci-dessus",
      ],
    },
    quota: {
      type: VoiceFlowErrorType.TTS_SYNTHESIS,
      code: "TTS_SYNTHESIS_QUOTA_EXCEEDED",
      message:
        "Le quota du service de synthese vocale est atteint. Le service est temporairement limite.",
      suggestions: [
        "Reessayez dans quelques minutes",
        "La reponse textuelle reste disponible ci-dessus",
        "Contactez l'administrateur si le probleme persiste",
      ],
    },
    textTooLong: {
      type: VoiceFlowErrorType.TTS_SYNTHESIS,
      code: "TTS_SYNTHESIS_TEXT_TOO_LONG",
      message:
        "Le texte a convertir en parole est trop long pour le service de synthese vocale.",
      suggestions: [
        "Essayez avec une demande plus courte",
        "La reponse textuelle reste disponible ci-dessus",
      ],
    },
    serviceUnavailable: {
      type: VoiceFlowErrorType.TTS_SYNTHESIS,
      code: "TTS_SYNTHESIS_SERVICE_UNAVAILABLE",
      message:
        "Le service de synthese vocale est actuellement indisponible. Veuillez reessayer ulterieurement.",
      suggestions: [
        "Reessayez dans quelques minutes",
        "La reponse textuelle reste disponible ci-dessus",
      ],
    },
  },
  [VoiceFlowErrorType.AUDIO_PLAYBACK]: {
    default: {
      type: VoiceFlowErrorType.AUDIO_PLAYBACK,
      code: "AUDIO_PLAYBACK_FAILED",
      message:
        "Erreur lors de la lecture audio. La reponse textuelle reste disponible ci-dessus.",
      suggestions: [
        "Verifiez que le son n'est pas coupe sur votre appareil",
        "Reessayez dans quelques instants",
        "La reponse textuelle reste disponible ci-dessus",
      ],
    },
    decodeError: {
      type: VoiceFlowErrorType.AUDIO_PLAYBACK,
      code: "AUDIO_PLAYBACK_DECODE_ERROR",
      message:
        "Impossible de decoder le fichier audio recu. Le format audio n'est pas pris en charge.",
      suggestions: [
        "Reessayez dans quelques instants",
        "La reponse textuelle reste disponible ci-dessus",
      ],
    },
    contextError: {
      type: VoiceFlowErrorType.AUDIO_PLAYBACK,
      code: "AUDIO_PLAYBACK_CONTEXT_ERROR",
      message:
        "Impossible d'initialiser la lecture audio. Votre navigateur a bloque la lecture automatique.",
      suggestions: [
        "Cliquez sur la page pour autoriser la lecture audio",
        "Verifiez les parametres de lecture automatique de votre navigateur",
        "La reponse textuelle reste disponible ci-dessus",
      ],
    },
  },
};

/**
 * Maps an ElevenLabs STT API HTTP status and response body to a typed VoiceFlowErrorInfo.
 * Used by the STT route to produce granular, user-facing error messages (IMP-9 / ADR-3).
 */
export function mapElevenLabsSttError(
  status: number,
  responseBody: string
): VoiceFlowErrorInfo {
  const sttErrors = VOICE_FLOW_ERRORS[VoiceFlowErrorType.STT_TRANSCRIPTION];

  if (status === 429) {
    return sttErrors.quota;
  }

  if (status === 422 || status === 415) {
    return sttErrors.audioFormat;
  }

  if (status === 503 || status === 502 || status === 504) {
    return sttErrors.serviceUnavailable;
  }

  if (status === 401 || status === 403) {
    return sttErrors.default;
  }

  // Try to detect audio format issues from response body
  const lowerBody = responseBody.toLowerCase();
  if (
    lowerBody.includes("audio") ||
    lowerBody.includes("format") ||
    lowerBody.includes("unsupported")
  ) {
    return sttErrors.audioFormat;
  }

  return sttErrors.default;
}

/**
 * Maps an Anthropic Claude API error to a typed VoiceFlowErrorInfo.
 * Used by the chat route to produce granular, user-facing error messages (IMP-10 / ADR-3).
 */
export function mapClaudeApiError(
  status: number,
  responseBody: string
): VoiceFlowErrorInfo {
  const claudeErrors =
    VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING];

  if (status === 429) {
    return claudeErrors.quota;
  }

  if (status === 529 || status === 503 || status === 502 || status === 504) {
    return claudeErrors.serviceUnavailable;
  }

  if (status === 400) {
    const lowerBody = responseBody.toLowerCase();
    if (
      lowerBody.includes("content") ||
      lowerBody.includes("inappropriate") ||
      lowerBody.includes("harmful") ||
      lowerBody.includes("unsafe")
    ) {
      return claudeErrors.contentFiltered;
    }
  }

  return claudeErrors.default;
}

/**
 * Maps an ElevenLabs TTS API HTTP status and response body to a typed VoiceFlowErrorInfo.
 * Used by the TTS route to produce granular, user-facing error messages (IMP-11 / ADR-3).
 */
export function mapElevenLabsTtsError(
  status: number,
  responseBody: string
): VoiceFlowErrorInfo {
  const ttsErrors = VOICE_FLOW_ERRORS[VoiceFlowErrorType.TTS_SYNTHESIS];

  if (status === 429) {
    return ttsErrors.quota;
  }

  if (status === 503 || status === 502 || status === 504) {
    return ttsErrors.serviceUnavailable;
  }

  if (status === 422 || status === 400) {
    const lowerBody = responseBody.toLowerCase();
    if (
      lowerBody.includes("too long") ||
      lowerBody.includes("text_too_long") ||
      lowerBody.includes("maximum") ||
      lowerBody.includes("length") ||
      lowerBody.includes("limit")
    ) {
      return ttsErrors.textTooLong;
    }
  }

  return ttsErrors.default;
}

/** Legacy error messages kept for backward compatibility. */
export const ERROR_MESSAGES: Record<VoiceFlowStep, string> = {
  capture: VOICE_FLOW_ERRORS[VoiceFlowErrorType.AUDIO_CAPTURE].default.message,
  transcription:
    VOICE_FLOW_ERRORS[VoiceFlowErrorType.STT_TRANSCRIPTION].default.message,
  processing:
    VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING].default.message,
  synthesis:
    VOICE_FLOW_ERRORS[VoiceFlowErrorType.TTS_SYNTHESIS].default.message,
  playing:
    VOICE_FLOW_ERRORS[VoiceFlowErrorType.AUDIO_PLAYBACK].default.message,
};
