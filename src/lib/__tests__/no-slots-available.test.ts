/**
 * Tests for IMP-36 / REQ-93: Gestion absence créneaux disponibles
 *
 * Acceptance criteria:
 * - L'absence de créneaux est détectée
 * - Un message vocal explicatif est diffusé
 * - Le patient est orienté vers une solution alternative
 * - Le flux de conversation se termine proprement
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  ConversationState,
  createSession,
  updateSession,
  isValidTransition,
  isValidState,
  buildStatePrompt,
  NO_SLOTS_MESSAGE,
  isTerminalState,
  _clearSessions,
} from "../conversation-state";
import {
  getAvailableSlots,
  hasNoAvailableSlots,
  type TimeSlot,
} from "../data";

describe("IMP-36 / REQ-93: Gestion absence créneaux disponibles", () => {
  beforeEach(() => {
    _clearSessions();
  });

  describe("Slot availability detection", () => {
    it("should return available slots from TIME_SLOTS", () => {
      const available = getAvailableSlots();
      expect(available.length).toBeGreaterThan(0);
      expect(available.every((s) => s.available)).toBe(true);
    });

    it("should return empty array when all slots are unavailable", () => {
      const allUnavailable: TimeSlot[] = [
        {
          id: "slot-1",
          date: "2026-06-10",
          time: "09:00",
          duration: 30,
          doctor: "Dr. Marie Dupont",
          available: false,
          patientName: "Patient A",
        },
        {
          id: "slot-2",
          date: "2026-06-10",
          time: "10:00",
          duration: 30,
          doctor: "Dr. Jean Martin",
          available: false,
          patientName: "Patient B",
        },
      ];
      expect(getAvailableSlots(allUnavailable)).toEqual([]);
    });

    it("should detect no available slots", () => {
      const allUnavailable: TimeSlot[] = [
        {
          id: "slot-1",
          date: "2026-06-10",
          time: "09:00",
          duration: 30,
          doctor: "Dr. Marie Dupont",
          available: false,
          patientName: "Patient A",
        },
      ];
      expect(hasNoAvailableSlots(allUnavailable)).toBe(true);
    });

    it("should detect available slots exist in default data", () => {
      expect(hasNoAvailableSlots()).toBe(false);
    });

    it("should detect no available slots when list is empty", () => {
      expect(hasNoAvailableSlots([])).toBe(true);
    });
  });

  describe("NO_SLOTS_AVAILABLE state", () => {
    it("should be a valid state", () => {
      expect(isValidState("NO_SLOTS_AVAILABLE")).toBe(true);
    });

    it("should be a terminal state (no outgoing transitions)", () => {
      expect(isTerminalState(ConversationState.NO_SLOTS_AVAILABLE)).toBe(true);
    });

    it("should allow transition from GREETING to NO_SLOTS_AVAILABLE", () => {
      expect(
        isValidTransition(
          ConversationState.GREETING,
          ConversationState.NO_SLOTS_AVAILABLE
        )
      ).toBe(true);
    });

    it("should allow transition from SLOT_PROPOSAL to NO_SLOTS_AVAILABLE", () => {
      expect(
        isValidTransition(
          ConversationState.SLOT_PROPOSAL,
          ConversationState.NO_SLOTS_AVAILABLE
        )
      ).toBe(true);
    });

    it("should not allow transition from NO_SLOTS_AVAILABLE to any state", () => {
      expect(
        isValidTransition(
          ConversationState.NO_SLOTS_AVAILABLE,
          ConversationState.GREETING
        )
      ).toBe(false);
      expect(
        isValidTransition(
          ConversationState.NO_SLOTS_AVAILABLE,
          ConversationState.SLOT_PROPOSAL
        )
      ).toBe(false);
    });
  });

  describe("NO_SLOTS_MESSAGE (vocal message)", () => {
    it("should inform patient about no available slots", () => {
      expect(NO_SLOTS_MESSAGE).toContain("plus de creneaux disponibles");
    });

    it("should provide the cabinet phone number as alternative", () => {
      expect(NO_SLOTS_MESSAGE).toContain("01 23 45 67 89");
    });

    it("should mention opening hours", () => {
      expect(NO_SLOTS_MESSAGE).toContain("lundi");
      expect(NO_SLOTS_MESSAGE).toContain("vendredi");
    });

    it("should end politely", () => {
      expect(NO_SLOTS_MESSAGE).toContain("bonne journee");
    });
  });

  describe("buildStatePrompt for NO_SLOTS_AVAILABLE", () => {
    it("should include NO_SLOTS_AVAILABLE state instructions", () => {
      const session = createSession();
      session.state = ConversationState.NO_SLOTS_AVAILABLE;
      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("NO_SLOTS_AVAILABLE");
      expect(prompt).toContain("plus de creneaux disponibles");
    });

    it("should mention the cabinet phone number", () => {
      const session = createSession();
      session.state = ConversationState.NO_SLOTS_AVAILABLE;
      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("01 23 45 67 89");
    });

    it("should instruct to orient patient to alternative", () => {
      const session = createSession();
      session.state = ConversationState.NO_SLOTS_AVAILABLE;
      const prompt = buildStatePrompt(session);
      expect(prompt).toContain("solution alternative");
    });
  });

  describe("Session transition to NO_SLOTS_AVAILABLE", () => {
    it("should update session from GREETING to NO_SLOTS_AVAILABLE", () => {
      const session = createSession();
      const updated = updateSession(session.id, {
        state: ConversationState.NO_SLOTS_AVAILABLE,
      });
      expect(updated).toBeDefined();
      expect(updated!.state).toBe(ConversationState.NO_SLOTS_AVAILABLE);
    });

    it("should update session from SLOT_PROPOSAL to NO_SLOTS_AVAILABLE", () => {
      const session = createSession();
      updateSession(session.id, {
        state: ConversationState.SLOT_PROPOSAL,
      });
      const updated = updateSession(session.id, {
        state: ConversationState.NO_SLOTS_AVAILABLE,
      });
      expect(updated).toBeDefined();
      expect(updated!.state).toBe(ConversationState.NO_SLOTS_AVAILABLE);
    });

    it("should not allow further updates from NO_SLOTS_AVAILABLE", () => {
      const session = createSession();
      updateSession(session.id, {
        state: ConversationState.NO_SLOTS_AVAILABLE,
      });
      const updated = updateSession(session.id, {
        state: ConversationState.SLOT_PROPOSAL,
      });
      expect(updated).toBeUndefined();
    });
  });

  describe("isTerminalState", () => {
    it("should return true for BOOKING", () => {
      expect(isTerminalState(ConversationState.BOOKING)).toBe(true);
    });

    it("should return true for NO_SLOTS_AVAILABLE", () => {
      expect(isTerminalState(ConversationState.NO_SLOTS_AVAILABLE)).toBe(true);
    });

    it("should return false for GREETING", () => {
      expect(isTerminalState(ConversationState.GREETING)).toBe(false);
    });

    it("should return false for SLOT_PROPOSAL", () => {
      expect(isTerminalState(ConversationState.SLOT_PROPOSAL)).toBe(false);
    });
  });
});
