import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSystemPrompt } from "../system-prompt";
import { TTS_CONFIG, getVoiceId } from "../tts-config";

describe("Configuration dialogue français naturel (IMP-38 / REQ-97)", () => {
  const prompt = buildSystemPrompt();

  describe("Toutes les réponses sont en français", () => {
    it("should instruct the assistant to respond in French", () => {
      expect(prompt).toContain("Tu reponds en francais");
    });

    it("should specify French language in general rules", () => {
      expect(prompt).toContain("Tu reponds en francais");
    });

    it("should use French politeness conventions (vouvoiement)", () => {
      expect(prompt).toContain("vouvoies toujours");
    });

    it("should never use informal address (tutoiement)", () => {
      // The prompt instructs to always use "vous" (vouvoiement)
      expect(prompt).toContain("vouvoies toujours le patient");
    });

    it("should include French greeting formulas", () => {
      expect(prompt).toContain("Bonjour");
    });
  });

  describe("Le vocabulaire est adapté au contexte médical", () => {
    it("should define the role as a medical secretary", () => {
      expect(prompt).toContain("secretaire medicale au telephone");
    });

    it("should reference medical context terms in the prompt", () => {
      expect(prompt).toContain("cabinet");
      expect(prompt).toContain("creneau");
    });

    it("should instruct professional but warm tone", () => {
      expect(prompt).toContain("professionnel mais chaleureux");
    });

    it("should define the oral-only style for medical context", () => {
      expect(prompt).toContain("ORAL PUR");
    });
  });

  describe("Les phrases sont naturelles et fluides", () => {
    it("should instruct concise responses", () => {
      expect(prompt).toContain("CONCISION");
      expect(prompt).toContain("courtes possible");
    });

    it("should instruct short responses per turn", () => {
      expect(prompt).toContain("Une ou deux phrases maximum");
    });

    it("should reference the role of a medical secretary", () => {
      expect(prompt).toContain("secretaire medicale");
    });

    it("should include the IMP-38 / REQ-97 reference in the prompt section", () => {
      expect(prompt).toContain("IMP-38");
      expect(prompt).toContain("REQ-97");
    });
  });

  describe("La configuration TTS utilise une voix française", () => {
    it("should configure a French voice ID by default", () => {
      // Charlotte — native French voice
      expect(TTS_CONFIG.voiceId).toBe("XB0fDUnXU5powFXDhCwa");
    });

    it("should use the multilingual v2 model for French support", () => {
      expect(TTS_CONFIG.modelId).toBe("eleven_multilingual_v2");
    });

    it("should configure STT language code as French", () => {
      expect(TTS_CONFIG.sttLanguageCode).toBe("fra");
    });

    it("should have voice settings with appropriate stability for professional tone", () => {
      expect(TTS_CONFIG.voiceSettings.stability).toBeGreaterThanOrEqual(0.5);
      expect(TTS_CONFIG.voiceSettings.stability).toBeLessThanOrEqual(1.0);
    });

    it("should have voice settings with style for natural conversation", () => {
      expect(TTS_CONFIG.voiceSettings.style).toBeDefined();
      expect(TTS_CONFIG.voiceSettings.style).toBeGreaterThan(0);
    });

    describe("getVoiceId()", () => {
      const originalEnv = process.env;

      beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
      });

      afterEach(() => {
        process.env = originalEnv;
      });

      it("should return the default French voice ID when no env override", () => {
        delete process.env.ELEVENLABS_VOICE_ID;
        expect(getVoiceId()).toBe(TTS_CONFIG.voiceId);
      });

      it("should allow overriding the voice ID via environment variable", () => {
        process.env.ELEVENLABS_VOICE_ID = "custom-voice-id";
        expect(getVoiceId()).toBe("custom-voice-id");
      });
    });
  });
});
