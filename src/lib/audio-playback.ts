/**
 * Audio playback utility with error handling (IMP-18 / REQ-14).
 *
 * Plays audio data using the Web Audio API with explicit volume control.
 * Returns a typed result for playback errors.
 */

import {
  VoiceFlowErrorType,
  VOICE_FLOW_ERRORS,
  type VoiceFlowErrorInfo,
} from "./errors";

const playbackErrors = VOICE_FLOW_ERRORS[VoiceFlowErrorType.AUDIO_PLAYBACK];

const DEFAULT_VOLUME = 1.0;

export type AudioPlaybackResult =
  | { ok: true }
  | { ok: false; error: VoiceFlowErrorInfo };

/**
 * Classifies an audio playback error into a typed VoiceFlowErrorInfo.
 */
export function classifyAudioPlaybackError(err: unknown): VoiceFlowErrorInfo {
  if (err instanceof DOMException) {
    if (err.name === "EncodingError" || err.name === "InvalidStateError") {
      return playbackErrors.decodeError;
    }
    if (err.name === "NotAllowedError") {
      return playbackErrors.contextError;
    }
  }

  if (
    err instanceof Error &&
    err.message.toLowerCase().includes("decode")
  ) {
    return playbackErrors.decodeError;
  }

  return playbackErrors.default;
}

/**
 * Plays audio from an ArrayBuffer using the Web Audio API.
 *
 * - Uses AudioContext with a GainNode for explicit volume control (default: 1.0).
 * - Returns a promise that resolves when playback finishes.
 * - Returns a typed error on failure (decode error, context blocked, etc.).
 */
export async function playAudio(
  audioData: ArrayBuffer,
  volume: number = DEFAULT_VOLUME
): Promise<AudioPlaybackResult> {
  let audioContext: AudioContext | null = null;

  try {
    audioContext = new AudioContext();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const audioBuffer = await audioContext.decodeAudioData(audioData);

    const gainNode = audioContext.createGain();
    gainNode.gain.value = Math.max(0, Math.min(1, volume));
    gainNode.connect(audioContext.destination);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);

    await new Promise<void>((resolve, reject) => {
      source.onended = () => resolve();
      try {
        source.start();
      } catch (err) {
        reject(err);
      }
    });

    await audioContext.close();
    return { ok: true };
  } catch (err) {
    if (audioContext) {
      try {
        await audioContext.close();
      } catch {
        // ignore close errors
      }
    }
    return { ok: false, error: classifyAudioPlaybackError(err) };
  }
}
