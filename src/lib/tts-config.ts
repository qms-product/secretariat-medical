/**
 * TTS configuration for natural French dialogue per IMP-38 / REQ-97.
 *
 * Configures ElevenLabs Text-to-Speech with a French voice and
 * language-appropriate parameters for natural medical office dialogue.
 */

/** ElevenLabs French voice configuration. */
export const TTS_CONFIG = {
  /**
   * ElevenLabs voice ID for French speech.
   * "Charlotte" — a native French female voice suitable for professional contexts.
   * Can be overridden via ELEVENLABS_VOICE_ID environment variable.
   */
  voiceId: "XB0fDUnXU5powFXDhCwa",

  /**
   * ElevenLabs model supporting multilingual (including French) synthesis.
   */
  modelId: "eleven_multilingual_v2",

  /**
   * Voice settings optimised for clear, natural French medical dialogue.
   * - stability: 0.6 — slightly higher for professional tone
   * - similarity_boost: 0.8 — strong voice consistency
   * - style: 0.3 — subtle expressiveness for natural conversation
   */
  voiceSettings: {
    stability: 0.6,
    similarity_boost: 0.8,
    style: 0.3,
  },

  /** ISO language code used for STT (Speech-to-Text) French transcription. */
  sttLanguageCode: "fra",
} as const;

/**
 * Returns the effective TTS voice ID, allowing override via environment variable.
 * This enables switching voices without code changes in production.
 */
export function getVoiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID || TTS_CONFIG.voiceId;
}
