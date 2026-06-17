import { describe, it, expect } from "vitest";
import {
  PgErrorType,
  PG_ERRORS,
  CalcomDatabaseError,
  CALCOM_VOICE_RESPONSES,
  getCalcomErrorVoiceResponse,
} from "../calcom-db-errors";

describe("Cal.com voice error responses (IMP-32 / ADR-12)", () => {
  describe("CALCOM_VOICE_RESPONSES", () => {
    it("should define a voice response for each PgErrorType", () => {
      for (const errorType of Object.values(PgErrorType)) {
        expect(CALCOM_VOICE_RESPONSES[errorType]).toBeDefined();
        expect(typeof CALCOM_VOICE_RESPONSES[errorType]).toBe("string");
        expect(CALCOM_VOICE_RESPONSES[errorType].length).toBeGreaterThan(0);
      }
    });

    it("should generate a specific message for timeouts mentioning temporary issue", () => {
      const msg = CALCOM_VOICE_RESPONSES[PgErrorType.TIMEOUT];
      expect(msg).toContain("temporaire");
      expect(msg).toContain("rappeler");
    });

    it("should generate a specific message for connection refused mentioning unavailability", () => {
      const msg = CALCOM_VOICE_RESPONSES[PgErrorType.CONNECTION_REFUSED];
      expect(msg).toContain("indisponible");
      expect(msg).toContain("rappeler");
    });

    it("should invite the patient to call back later for all error types", () => {
      for (const errorType of Object.values(PgErrorType)) {
        expect(CALCOM_VOICE_RESPONSES[errorType]).toContain("rappeler");
      }
    });

    it("should have distinct messages for timeout vs connection refused", () => {
      expect(CALCOM_VOICE_RESPONSES[PgErrorType.TIMEOUT]).not.toBe(
        CALCOM_VOICE_RESPONSES[PgErrorType.CONNECTION_REFUSED]
      );
    });

    it("should be in French", () => {
      for (const errorType of Object.values(PgErrorType)) {
        const msg = CALCOM_VOICE_RESPONSES[errorType];
        // Check for French-specific words
        expect(msg).toMatch(/desole|rendez-vous|rappeler|indisponible|erreur/);
      }
    });
  });

  describe("getCalcomErrorVoiceResponse", () => {
    it("should return timeout voice response for CalcomDatabaseError with TIMEOUT type", () => {
      const error = new CalcomDatabaseError(PG_ERRORS[PgErrorType.TIMEOUT]);
      const response = getCalcomErrorVoiceResponse(error);
      expect(response).toBe(CALCOM_VOICE_RESPONSES[PgErrorType.TIMEOUT]);
    });

    it("should return connection refused voice response for CalcomDatabaseError with CONNECTION_REFUSED type", () => {
      const error = new CalcomDatabaseError(
        PG_ERRORS[PgErrorType.CONNECTION_REFUSED]
      );
      const response = getCalcomErrorVoiceResponse(error);
      expect(response).toBe(
        CALCOM_VOICE_RESPONSES[PgErrorType.CONNECTION_REFUSED]
      );
    });

    it("should return unknown voice response for CalcomDatabaseError with UNKNOWN type", () => {
      const error = new CalcomDatabaseError(PG_ERRORS[PgErrorType.UNKNOWN]);
      const response = getCalcomErrorVoiceResponse(error);
      expect(response).toBe(CALCOM_VOICE_RESPONSES[PgErrorType.UNKNOWN]);
    });

    it("should accept PgErrorInfo directly", () => {
      const response = getCalcomErrorVoiceResponse(
        PG_ERRORS[PgErrorType.TIMEOUT]
      );
      expect(response).toBe(CALCOM_VOICE_RESPONSES[PgErrorType.TIMEOUT]);
    });

    it("should return a message suitable for TTS (no special characters or markup)", () => {
      for (const errorType of Object.values(PgErrorType)) {
        const error = new CalcomDatabaseError(PG_ERRORS[errorType]);
        const response = getCalcomErrorVoiceResponse(error);
        // Should not contain HTML, markdown, or code-like characters
        expect(response).not.toMatch(/[<>{}[\]#*`]/);
      }
    });
  });
});
