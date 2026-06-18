import { describe, it, expect, beforeEach } from "vitest";
import {
  ConversationState,
  createSession,
  updateSession,
  buildStatePrompt,
  _clearSessions,
  MAX_VALIDATION_RETRIES,
} from "../conversation-state";
import { buildSystemPrompt } from "../system-prompt";
import { validatePatientData } from "../patient-validation";

describe("Validation in conversational flow (IMP-28 / ADR-9)", () => {
  beforeEach(() => {
    _clearSessions();
  });

  describe("System prompt includes validation error handling", () => {
    const prompt = buildSystemPrompt();

    it("should contain validation section header", () => {
      expect(prompt).toContain("VALIDATION DES DONNEES PATIENT");
    });

    it("should instruct natural reformulation of errors", () => {
      expect(prompt).toContain("reformules naturellement");
    });

    it("should instruct short reformulation of errors", () => {
      expect(prompt).toContain("phrase courte");
    });

    it("should provide an example of error reformulation", () => {
      expect(prompt).toContain("Je n'ai pas bien compris votre email");
    });

    it("should suggest alternative contact after multiple failed attempts", () => {
      expect(prompt).toContain("nous joindre au");
    });

    it("should provide email error reformulation example", () => {
      expect(prompt).toContain("votre email");
    });

    it("should provide phone number as fallback", () => {
      expect(prompt).toContain("01 23 45 67 89");
    });
  });

  describe("Validation error messages are natural (conversational)", () => {
    it("should generate a conversational message for invalid email", () => {
      const result = validatePatientData({ email: "not-valid" });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("repeter");
    });

    it("should generate a conversational message for invalid phone", () => {
      const result = validatePatientData({
        email: "ok@test.fr",
        phone: "+1 555 123",
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("repeter");
      expect(result.errors[0].message).toContain("francais");
    });
  });

  describe("Retry logic in conversation state", () => {
    it("should initialize validation retries to zero", () => {
      const session = createSession();
      expect(session.validationRetries).toEqual({ email: 0, phone: 0 });
    });

    it("should allow updating validation retries", () => {
      const session = createSession();
      const updated = updateSession(session.id, {
        validationRetries: { email: 1, phone: 0 },
      });
      expect(updated).toBeDefined();
      expect(updated!.validationRetries.email).toBe(1);
      expect(updated!.validationRetries.phone).toBe(0);
    });

    it("should track retries independently per field", () => {
      const session = createSession();
      updateSession(session.id, {
        validationRetries: { email: 2, phone: 1 },
      });
      const retrieved = updateSession(session.id, {
        validationRetries: { email: 3, phone: 1 },
      });
      expect(retrieved!.validationRetries.email).toBe(3);
      expect(retrieved!.validationRetries.phone).toBe(1);
    });

    it("should define MAX_VALIDATION_RETRIES as 3", () => {
      expect(MAX_VALIDATION_RETRIES).toBe(3);
    });
  });

  describe("State prompt includes validation errors in INFO_COLLECTION", () => {
    it("should include validation errors when patient data is invalid", () => {
      const session = createSession();
      session.state = ConversationState.INFO_COLLECTION;
      session.patientInfo = { name: "Jean", email: "invalid", phone: "123" };
      session.validationRetries = { email: 1, phone: 0 };

      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("ERREURS DE VALIDATION DETECTEES");
      expect(prompt).toContain("email");
      expect(prompt).toContain("phone");
      expect(prompt).toContain("correction");
    });

    it("should not include validation errors when data is valid", () => {
      const session = createSession();
      session.state = ConversationState.INFO_COLLECTION;
      session.patientInfo = {
        name: "Jean",
        email: "jean@test.fr",
        phone: "06 12 34 56 78",
      };
      session.validationRetries = { email: 0, phone: 0 };

      const prompt = buildStatePrompt(session);
      expect(prompt).not.toContain("ERREURS DE VALIDATION DETECTEES");
    });

    it("should not include validation errors when no data collected yet", () => {
      const session = createSession();
      session.state = ConversationState.INFO_COLLECTION;

      const prompt = buildStatePrompt(session);
      // Email is required so there will be validation errors for missing email
      expect(prompt).toContain("ERREURS DE VALIDATION DETECTEES");
      expect(prompt).toContain("email");
    });

    it("should indicate retry count in validation error context", () => {
      const session = createSession();
      session.state = ConversationState.INFO_COLLECTION;
      session.patientInfo = { email: "bad" };
      session.validationRetries = { email: 2, phone: 0 };

      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("tentative 3/3");
    });

    it("should indicate when retry limit is reached", () => {
      const session = createSession();
      session.state = ConversationState.INFO_COLLECTION;
      session.patientInfo = { email: "bad" };
      session.validationRetries = { email: 3, phone: 0 };

      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("LIMITE ATTEINTE");
      expect(prompt).toContain("alternative");
    });

    it("should instruct LLM to validate before transitioning to CONFIRMATION", () => {
      const session = createSession();
      session.state = ConversationState.INFO_COLLECTION;
      session.patientInfo = {};
      session.validationRetries = { email: 0, phone: 0 };

      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("valide");
      expect(prompt).toContain("CONFIRMATION");
    });
  });

  describe("Validation blocks INFO_COLLECTION → CONFIRMATION transition", () => {
    it("should reject transition when email is invalid", () => {
      const result = validatePatientData({
        email: "not-valid",
        phone: "06 12 34 56 78",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "email")).toBe(true);
    });

    it("should reject transition when phone is invalid", () => {
      const result = validatePatientData({
        email: "jean@test.fr",
        phone: "123",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "phone")).toBe(true);
    });

    it("should allow transition when all data is valid", () => {
      const result = validatePatientData({
        email: "jean@test.fr",
        phone: "06 12 34 56 78",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should allow transition when phone is not provided (optional)", () => {
      const result = validatePatientData({
        email: "jean@test.fr",
      });
      expect(result.valid).toBe(true);
    });

    it("should collect all errors when both fields are invalid", () => {
      const result = validatePatientData({
        email: "invalid",
        phone: "+1 555 0000",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("Retry limit behavior", () => {
    it("should increment retries correctly across attempts", () => {
      const session = createSession();
      // Move to INFO_COLLECTION state
      updateSession(session.id, {
        state: ConversationState.SLOT_PROPOSAL,
      });
      updateSession(session.id, {
        state: ConversationState.INFO_COLLECTION,
      });

      // Simulate 3 failed email attempts
      for (let i = 1; i <= MAX_VALIDATION_RETRIES; i++) {
        const updated = updateSession(session.id, {
          validationRetries: { email: i, phone: 0 },
          patientInfo: { email: "bad-email" },
        });
        expect(updated!.validationRetries.email).toBe(i);
      }

      expect(
        session.validationRetries.email >= MAX_VALIDATION_RETRIES
      ).toBe(true);
    });

    it("should show LIMITE ATTEINTE when retries exceed maximum", () => {
      const session = createSession();
      session.state = ConversationState.INFO_COLLECTION;
      session.patientInfo = { email: "bad" };
      session.validationRetries = {
        email: MAX_VALIDATION_RETRIES,
        phone: 0,
      };

      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("LIMITE ATTEINTE");
    });

    it("should not show LIMITE ATTEINTE when retries are below maximum", () => {
      const session = createSession();
      session.state = ConversationState.INFO_COLLECTION;
      session.patientInfo = { email: "bad" };
      session.validationRetries = {
        email: MAX_VALIDATION_RETRIES - 1,
        phone: 0,
      };

      const prompt = buildStatePrompt(session);
      expect(prompt).not.toContain("LIMITE ATTEINTE");
    });
  });
});
