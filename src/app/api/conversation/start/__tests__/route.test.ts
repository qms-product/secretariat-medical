import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { _clearSessions, ConversationState, NO_SLOTS_MESSAGE } from "@/lib/conversation-state";

const { mockHasNoAvailableSlots } = vi.hoisted(() => {
  return { mockHasNoAvailableSlots: vi.fn().mockReturnValue(false) };
});

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    hasNoAvailableSlots: mockHasNoAvailableSlots,
  };
});

const { mockCreate, MockAPIConnectionTimeoutError, MockAPIError } = vi.hoisted(
  () => {
    const mockCreate = vi.fn();
    class MockAPIConnectionTimeoutError extends Error {
      constructor() {
        super("Connection timed out");
        this.name = "APIConnectionTimeoutError";
      }
    }
    class MockAPIError extends Error {
      constructor(public readonly status: number) {
        super(`API error ${status}`);
        this.name = "APIError";
      }
    }
    return { mockCreate, MockAPIConnectionTimeoutError, MockAPIError };
  }
);

vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  return {
    default: Object.assign(MockAnthropic, {
      APIConnectionTimeoutError: MockAPIConnectionTimeoutError,
      APIError: MockAPIError,
    }),
  };
});

import { POST } from "../../start/route";

describe("POST /api/conversation/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearSessions();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    _clearSessions();
  });

  it("should return 500 when ANTHROPIC_API_KEY is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("ANTHROPIC_API_KEY not configured");
  });

  // AC: Endpoint /api/conversation/start initialise une nouvelle conversation en etat GREETING
  it("should initialize a conversation and return greeting with state", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: 'Bonjour! Je suis l\'assistant du cabinet medical.\n{"next_state": "SLOT_PROPOSAL"}',
        },
      ],
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conversationId).toMatch(/^conv_/);
    expect(body.state).toBe("SLOT_PROPOSAL");
    expect(body.reply).toContain("Bonjour");
    expect(body.reply).not.toContain("next_state");
    expect(body.patientInfo).toEqual({});
  });

  // AC: Les reponses API incluent l'etat actuel et les metadonnees de conversation
  it("should include conversation metadata in response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Bonjour!" }],
    });

    const response = await POST();
    const body = await response.json();

    expect(body).toHaveProperty("conversationId");
    expect(body).toHaveProperty("state");
    expect(body).toHaveProperty("reply");
    expect(body).toHaveProperty("patientInfo");
  });

  it("should default to SLOT_PROPOSAL when no state marker in response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: "text", text: "Bonjour! Comment puis-je vous aider?" },
      ],
    });

    const response = await POST();
    const body = await response.json();

    expect(body.state).toBe("SLOT_PROPOSAL");
  });

  it("should return 504 on Claude API timeout", async () => {
    mockCreate.mockRejectedValueOnce(new MockAPIConnectionTimeoutError());

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.error).toBeDefined();
  });

  it("should return appropriate error on Claude API error", async () => {
    mockCreate.mockRejectedValueOnce(new MockAPIError(429));

    const response = await POST();

    expect(response.status).toBe(429);
  });

  it("should return 500 on unexpected error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Unexpected"));

    const response = await POST();

    expect(response.status).toBe(500);
  });

  // IMP-36: Gestion absence créneaux disponibles
  describe("(IMP-36) No slots available", () => {
    it("should return NO_SLOTS_AVAILABLE state when no slots are available", async () => {
      mockHasNoAvailableSlots.mockReturnValueOnce(true);

      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.state).toBe(ConversationState.NO_SLOTS_AVAILABLE);
    });

    it("should return a vocal message explaining no slots", async () => {
      mockHasNoAvailableSlots.mockReturnValueOnce(true);

      const response = await POST();
      const body = await response.json();

      expect(body.reply).toBe(NO_SLOTS_MESSAGE);
      expect(body.reply).toContain("plus de creneaux disponibles");
    });

    it("should orient the patient to an alternative (phone number)", async () => {
      mockHasNoAvailableSlots.mockReturnValueOnce(true);

      const response = await POST();
      const body = await response.json();

      expect(body.reply).toContain("01 23 45 67 89");
    });

    it("should not call the Claude API when no slots are available", async () => {
      mockHasNoAvailableSlots.mockReturnValueOnce(true);

      await POST();

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should include a valid conversationId", async () => {
      mockHasNoAvailableSlots.mockReturnValueOnce(true);

      const response = await POST();
      const body = await response.json();

      expect(body.conversationId).toMatch(/^conv_/);
    });
  });
});
