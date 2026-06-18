import { describe, it, expect, beforeEach } from "vitest";
import {
  ConversationState,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  isValidTransition,
  isValidState,
  buildStatePrompt,
  parseStateMarkers,
  _clearSessions,
  _getSessionsMap,
} from "../conversation-state";

describe("conversation-state", () => {
  beforeEach(() => {
    _clearSessions();
  });

  describe("ConversationState enum", () => {
    it("should have all required states", () => {
      expect(ConversationState.GREETING).toBe("GREETING");
      expect(ConversationState.SLOT_PROPOSAL).toBe("SLOT_PROPOSAL");
      expect(ConversationState.INFO_COLLECTION).toBe("INFO_COLLECTION");
      expect(ConversationState.CONFIRMATION).toBe("CONFIRMATION");
      expect(ConversationState.BOOKING).toBe("BOOKING");
    });
  });

  describe("isValidState", () => {
    it("should return true for valid states", () => {
      expect(isValidState("GREETING")).toBe(true);
      expect(isValidState("SLOT_PROPOSAL")).toBe(true);
      expect(isValidState("BOOKING")).toBe(true);
    });

    it("should return false for invalid states", () => {
      expect(isValidState("INVALID")).toBe(false);
      expect(isValidState("")).toBe(false);
    });
  });

  describe("isValidTransition", () => {
    it("should allow GREETING → SLOT_PROPOSAL", () => {
      expect(
        isValidTransition(
          ConversationState.GREETING,
          ConversationState.SLOT_PROPOSAL
        )
      ).toBe(true);
    });

    it("should allow SLOT_PROPOSAL → INFO_COLLECTION", () => {
      expect(
        isValidTransition(
          ConversationState.SLOT_PROPOSAL,
          ConversationState.INFO_COLLECTION
        )
      ).toBe(true);
    });

    it("should allow SLOT_PROPOSAL → SLOT_PROPOSAL (reject and re-propose)", () => {
      expect(
        isValidTransition(
          ConversationState.SLOT_PROPOSAL,
          ConversationState.SLOT_PROPOSAL
        )
      ).toBe(true);
    });

    it("should allow INFO_COLLECTION → CONFIRMATION", () => {
      expect(
        isValidTransition(
          ConversationState.INFO_COLLECTION,
          ConversationState.CONFIRMATION
        )
      ).toBe(true);
    });

    it("should allow CONFIRMATION → BOOKING", () => {
      expect(
        isValidTransition(
          ConversationState.CONFIRMATION,
          ConversationState.BOOKING
        )
      ).toBe(true);
    });

    it("should allow CONFIRMATION → SLOT_PROPOSAL (modify)", () => {
      expect(
        isValidTransition(
          ConversationState.CONFIRMATION,
          ConversationState.SLOT_PROPOSAL
        )
      ).toBe(true);
    });

    it("should not allow GREETING → BOOKING (skip states)", () => {
      expect(
        isValidTransition(
          ConversationState.GREETING,
          ConversationState.BOOKING
        )
      ).toBe(false);
    });

    it("should not allow BOOKING → any (terminal state)", () => {
      expect(
        isValidTransition(
          ConversationState.BOOKING,
          ConversationState.GREETING
        )
      ).toBe(false);
    });
  });

  describe("createSession", () => {
    it("should create a session in GREETING state", () => {
      const session = createSession();
      expect(session.state).toBe(ConversationState.GREETING);
      expect(session.id).toMatch(/^conv_/);
      expect(session.messages).toEqual([]);
      expect(session.patientInfo).toEqual({});
      expect(session.selectedSlot).toBeUndefined();
    });

    it("should store the session in memory", () => {
      const session = createSession();
      const retrieved = getSession(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(session.id);
    });
  });

  describe("getSession", () => {
    it("should return undefined for non-existent session", () => {
      expect(getSession("non-existent")).toBeUndefined();
    });

    it("should return the session when it exists", () => {
      const session = createSession();
      const retrieved = getSession(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.state).toBe(ConversationState.GREETING);
    });

    it("should return undefined for expired sessions", () => {
      const session = createSession();
      // Manually expire the session
      const storedSession = _getSessionsMap().get(session.id)!;
      storedSession.updatedAt = Date.now() - 31 * 60 * 1000;

      expect(getSession(session.id)).toBeUndefined();
    });
  });

  describe("updateSession", () => {
    it("should update state with valid transition", () => {
      const session = createSession();
      const updated = updateSession(session.id, {
        state: ConversationState.SLOT_PROPOSAL,
      });
      expect(updated).toBeDefined();
      expect(updated!.state).toBe(ConversationState.SLOT_PROPOSAL);
    });

    it("should return undefined for invalid transition", () => {
      const session = createSession();
      const updated = updateSession(session.id, {
        state: ConversationState.BOOKING,
      });
      expect(updated).toBeUndefined();
    });

    it("should update messages", () => {
      const session = createSession();
      const messages = [{ role: "user" as const, content: "Bonjour" }];
      const updated = updateSession(session.id, { messages });
      expect(updated!.messages).toEqual(messages);
    });

    it("should update patientInfo", () => {
      const session = createSession();
      const updated = updateSession(session.id, {
        patientInfo: { name: "Jean Dupont" },
      });
      expect(updated!.patientInfo.name).toBe("Jean Dupont");
    });

    it("should update selectedSlot", () => {
      const session = createSession();
      const updated = updateSession(session.id, {
        selectedSlot: "2026-06-15 09:00",
      });
      expect(updated!.selectedSlot).toBe("2026-06-15 09:00");
    });

    it("should return undefined for non-existent session", () => {
      expect(
        updateSession("non-existent", {
          state: ConversationState.SLOT_PROPOSAL,
        })
      ).toBeUndefined();
    });

    it("should allow same-state updates (no transition)", () => {
      const session = createSession();
      const updated = updateSession(session.id, {
        messages: [{ role: "user", content: "Test" }],
      });
      expect(updated).toBeDefined();
      expect(updated!.state).toBe(ConversationState.GREETING);
    });
  });

  describe("deleteSession", () => {
    it("should delete an existing session", () => {
      const session = createSession();
      expect(deleteSession(session.id)).toBe(true);
      expect(getSession(session.id)).toBeUndefined();
    });

    it("should return false for non-existent session", () => {
      expect(deleteSession("non-existent")).toBe(false);
    });
  });

  describe("buildStatePrompt", () => {
    it("should include GREETING state instructions", () => {
      const session = createSession();
      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("GREETING");
      expect(prompt).toContain("Accueille");
    });

    it("should include SLOT_PROPOSAL state instructions", () => {
      const session = createSession();
      session.state = ConversationState.SLOT_PROPOSAL;
      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("SLOT_PROPOSAL");
      expect(prompt).toContain("creneau");
    });

    it("should include patient info in INFO_COLLECTION prompt", () => {
      const session = createSession();
      session.state = ConversationState.INFO_COLLECTION;
      session.patientInfo = { name: "Jean" };
      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("INFO_COLLECTION");
      expect(prompt).toContain("Jean");
    });

    it("should include selected slot and patient info in CONFIRMATION prompt", () => {
      const session = createSession();
      session.state = ConversationState.CONFIRMATION;
      session.selectedSlot = "2026-06-15 09:00";
      session.patientInfo = { name: "Jean", email: "jean@test.com" };
      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("CONFIRMATION");
      expect(prompt).toContain("2026-06-15 09:00");
      expect(prompt).toContain("jean@test.com");
    });

    it("should include BOOKING state instructions", () => {
      const session = createSession();
      session.state = ConversationState.BOOKING;
      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("BOOKING");
      expect(prompt).toContain("cree le rendez-vous");
    });
  });

  describe("parseStateMarkers", () => {
    it("should extract next_state from response", () => {
      const reply =
        'Bonjour!\n{"next_state": "SLOT_PROPOSAL"}\n';
      const result = parseStateMarkers(reply);
      expect(result.nextState).toBe(ConversationState.SLOT_PROPOSAL);
      expect(result.cleanReply).toBe("Bonjour!");
    });

    it("should extract selected_slot", () => {
      const reply =
        'Parfait!\n{"next_state": "INFO_COLLECTION", "selected_slot": "2026-06-15 09:00"}\n';
      const result = parseStateMarkers(reply);
      expect(result.nextState).toBe(ConversationState.INFO_COLLECTION);
      expect(result.selectedSlot).toBe("2026-06-15 09:00");
    });

    it("should extract patient_info", () => {
      const reply =
        'Merci.\n{"next_state": "CONFIRMATION", "patient_info": {"name": "Jean", "email": "jean@test.com", "phone": "0612345678"}}\n';
      const result = parseStateMarkers(reply);
      expect(result.nextState).toBe(ConversationState.CONFIRMATION);
      expect(result.patientInfo).toEqual({
        name: "Jean",
        email: "jean@test.com",
        phone: "0612345678",
      });
    });

    it("should return clean reply without markers", () => {
      const reply =
        'Bonjour! Je suis l\'assistant.\n{"next_state": "SLOT_PROPOSAL"}\n';
      const result = parseStateMarkers(reply);
      expect(result.cleanReply).not.toContain("next_state");
      expect(result.cleanReply).toContain("Bonjour");
    });

    it("should handle response with no markers", () => {
      const reply = "Bonjour! Comment puis-je vous aider?";
      const result = parseStateMarkers(reply);
      expect(result.nextState).toBeUndefined();
      expect(result.cleanReply).toBe(reply);
    });

    it("should ignore invalid state values", () => {
      const reply = '{"next_state": "INVALID_STATE"}\nBonjour!';
      const result = parseStateMarkers(reply);
      expect(result.nextState).toBeUndefined();
    });
  });

  describe("session expiration cleanup", () => {
    it("should clean up expired sessions on createSession", () => {
      const session1 = createSession();
      // Manually expire
      const stored = _getSessionsMap().get(session1.id)!;
      stored.updatedAt = Date.now() - 31 * 60 * 1000;

      // Create new session triggers cleanup
      createSession();
      expect(_getSessionsMap().has(session1.id)).toBe(false);
    });
  });
});
