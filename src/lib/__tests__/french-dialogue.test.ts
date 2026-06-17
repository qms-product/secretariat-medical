import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSystemPrompt } from "../system-prompt";
import { TTS_CONFIG, getVoiceId } from "../tts-config";

describe("Configuration dialogue français naturel (IMP-38 / REQ-97)", () => {
  const prompt = buildSystemPrompt();

  describe("Toutes les réponses sont en français", () => {
    it("should instruct the assistant to respond exclusively in French", () => {
      expect(prompt).toContain("exclusivement en francais");
    });

    it("should specify French language in general rules", () => {
      expect(prompt).toContain("Tu reponds en francais");
    });

    it("should use French politeness conventions (vouvoiement)", () => {
      expect(prompt).toContain("vouvoiement");
    });

    it("should never use informal address (tutoiement)", () => {
      expect(prompt).toContain("tutoies jamais");
    });

    it("should include French greeting formulas", () => {
      expect(prompt).toContain("Bonjour");
      expect(prompt).toContain("Bonne journee");
    });
  });

  describe("Le vocabulaire est adapté au contexte médical", () => {
    it("should specify use of medical vocabulary accessible to patients", () => {
      expect(prompt).toContain("vocabulaire medical courant");
    });

    it("should list expected medical terms", () => {
      expect(prompt).toContain("consultation");
      expect(prompt).toContain("creneau");
      expect(prompt).toContain("praticien");
      expect(prompt).toContain("cabinet");
    });

    it("should instruct to avoid unnecessary technical jargon", () => {
      expect(prompt).toContain("jargon technique inutile");
    });

    it("should specify a professional register for medical context", () => {
      expect(prompt).toContain("registre professionnel");
      expect(prompt).toContain("contexte medical");
    });
  });

  describe("Les phrases sont naturelles et fluides", () => {
    it("should instruct natural and fluid speech style", () => {
      expect(prompt).toContain("naturelles et fluides");
    });

    it("should instruct short, clear, and direct sentences", () => {
      expect(prompt).toContain("courtes, claires et directes");
    });

    it("should reference the tone of an experienced medical secretary", () => {
      expect(prompt).toContain("secretaire medicale experimentee");
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
