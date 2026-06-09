/**
 * MediaRecorder wrapper with granular error handling (IMP-8 / ADR-3).
 *
 * Detects microphone permission errors, device-not-found errors,
 * browser incompatibility, and MediaRecorder initialization failures,
 * returning typed VoiceFlowErrorInfo for each case.
 */

import {
  VoiceFlowErrorType,
  VOICE_FLOW_ERRORS,
  type VoiceFlowErrorInfo,
} from "./errors";

const captureErrors = VOICE_FLOW_ERRORS[VoiceFlowErrorType.AUDIO_CAPTURE];

/** Browser compatibility error (no MediaRecorder or getUserMedia support). */
const BROWSER_NOT_SUPPORTED: VoiceFlowErrorInfo = {
  type: VoiceFlowErrorType.AUDIO_CAPTURE,
  code: "AUDIO_CAPTURE_BROWSER_NOT_SUPPORTED",
  message:
    "Votre navigateur ne supporte pas la capture audio. Veuillez utiliser un navigateur compatible.",
  suggestions: [
    "Utilisez une version recente de Chrome, Firefox, Edge ou Safari",
    "Mettez a jour votre navigateur",
  ],
};

export type AudioCaptureResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; error: VoiceFlowErrorInfo };

/**
 * Returns true if the browser supports both getUserMedia and MediaRecorder.
 */
export function isAudioCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

/**
 * Classifies a getUserMedia / MediaRecorder error into a VoiceFlowErrorInfo.
 */
export function classifyAudioCaptureError(err: unknown): VoiceFlowErrorInfo {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return captureErrors.permissionDenied;
      case "NotFoundError":
      case "DevicesNotFoundError":
        return captureErrors.notFound;
      case "NotReadableError":
      case "TrackStartError":
        return {
          type: VoiceFlowErrorType.AUDIO_CAPTURE,
          code: "AUDIO_CAPTURE_NOT_READABLE",
          message:
            "Le microphone est utilise par une autre application ou n'est pas accessible.",
          suggestions: [
            "Fermez les autres applications utilisant le microphone",
            "Debranchez puis rebranchez votre microphone",
            "Rechargez la page",
          ],
        };
      case "OverconstrainedError":
        return captureErrors.notFound;
    }
  }

  if (err instanceof TypeError) {
    return BROWSER_NOT_SUPPORTED;
  }

  return captureErrors.default;
}

/**
 * Requests microphone access and returns either a MediaStream or a typed error.
 */
export async function requestAudioCapture(): Promise<AudioCaptureResult> {
  if (!isAudioCaptureSupported()) {
    return { ok: false, error: BROWSER_NOT_SUPPORTED };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return { ok: true, stream };
  } catch (err) {
    return { ok: false, error: classifyAudioCaptureError(err) };
  }
}
