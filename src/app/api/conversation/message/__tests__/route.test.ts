import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

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

// Import route after mock is set up (conversation-state is NOT mocked - uses real in-memory store)
import { POST } from "../../message/route";
import {
  createSession,
  updateSession,
  getSession,
  ConversationState,
  _clearSessions,
} from "@/lib/conversation-state";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3001/api/conversation/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createInvalidJsonRequest(): NextRequest {
  return new NextRequest("http://localhost:3001/api/conversation/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json{",
  });
}

describe("POST /api/conversation/message", () => {
  let sessionId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    _clearSessions();
    process.env.ANTHROPIC_API_KEY = "test-key";

    // Create a session in SLOT_PROPOSAL state (typical after /start)
    const session = createSession();
    updateSession(session.id, {
      state: ConversationState.SLOT_PROPOSAL,
      messages: [
        { role: "user", content: "Bonjour" },
        {
          role: "assistant",
          content: "Bonjour! Voici les creneaux disponibles.",
        },
      ],
    });
    sessionId = session.id;
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    _clearSessions();
  });

  it("should return 500 when ANTHROPIC_API_KEY is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const response = await POST(
      createRequest({ conversationId: sessionId, message: "Oui" })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("ANTHROPIC_API_KEY not configured");
  });

  it("should return 400 for invalid JSON body", async () => {
    const response = await POST(createInvalidJsonRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("JSON");
  });

  it("should return 400 when conversationId is missing", async () => {
    const response = await POST(createRequest({ message: "Oui" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("conversationId");
  });

  it("should return 400 when message is missing", async () => {
    const response = await POST(
      createRequest({ conversationId: sessionId })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("message");
  });

  it("should return 400 when message is empty", async () => {
    const response = await POST(
      createRequest({ conversationId: sessionId, message: "   " })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("message");
  });

  it("should return 404 when conversation does not exist", async () => {
    const response = await POST(
      createRequest({ conversationId: "non-existent", message: "Oui" })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("introuvable");
  });

  // AC: La gestion d'erreur est implementee pour les etats invalides
  it("should return 400 when conversation is in terminal BOOKING state", async () => {
    const terminalSession = createSession();
    updateSession(terminalSession.id, {
      state: ConversationState.SLOT_PROPOSAL,
    });
    updateSession(terminalSession.id, {
      state: ConversationState.INFO_COLLECTION,
    });
    updateSession(terminalSession.id, {
      state: ConversationState.CONFIRMATION,
    });
    updateSession(terminalSession.id, {
      state: ConversationState.BOOKING,
    });

    const response = await POST(
      createRequest({
        conversationId: terminalSession.id,
        message: "Encore un message",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("terminee");
  });

  // AC: Endpoint /api/conversation/message traite les messages et retourne la reponse avec nouvel etat
  it("should process message and return reply with state", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: 'Parfait! Voici vos informations.\n{"next_state": "INFO_COLLECTION", "selected_slot": "2026-06-15 09:00"}',
        },
      ],
    });

    const response = await POST(
      createRequest({
        conversationId: sessionId,
        message: "Oui, le creneau de 9h me convient",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conversationId).toBe(sessionId);
    expect(body.state).toBe("INFO_COLLECTION");
    expect(body.reply).toContain("Parfait");
    expect(body.reply).not.toContain("next_state");
    expect(body.selectedSlot).toBe("2026-06-15 09:00");
  });

  // AC: Les reponses API incluent l'etat actuel et les metadonnees de conversation
  it("should include all metadata in response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Voici un autre creneau." }],
    });

    const response = await POST(
      createRequest({
        conversationId: sessionId,
        message: "Non merci",
      })
    );
    const body = await response.json();

    expect(body).toHaveProperty("conversationId");
    expect(body).toHaveProperty("state");
    expect(body).toHaveProperty("reply");
    expect(body).toHaveProperty("patientInfo");
  });

  // AC: L'etat de conversation est maintenu en memoire pendant la session
  it("should maintain conversation history across messages", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Un autre creneau est disponible." }],
    });

    await POST(
      createRequest({
        conversationId: sessionId,
        message: "Non merci",
      })
    );

    const session = getSession(sessionId);
    expect(session!.messages.length).toBe(4); // 2 original + 1 user + 1 assistant
    expect(session!.messages[2].role).toBe("user");
    expect(session!.messages[2].content).toBe("Non merci");
    expect(session!.messages[3].role).toBe("assistant");
  });

  it("should update patient info when provided by LLM", async () => {
    updateSession(sessionId, {
      state: ConversationState.INFO_COLLECTION,
      selectedSlot: "2026-06-15 09:00",
    });

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: 'Merci! Et votre email?\n{"next_state": "INFO_COLLECTION", "patient_info": {"name": "Jean Dupont"}}',
        },
      ],
    });

    const response = await POST(
      createRequest({
        conversationId: sessionId,
        message: "Je m'appelle Jean Dupont",
      })
    );
    const body = await response.json();

    expect(body.patientInfo.name).toBe("Jean Dupont");
  });

  it("should return 504 on Claude API timeout", async () => {
    mockCreate.mockRejectedValueOnce(new MockAPIConnectionTimeoutError());

    const response = await POST(
      createRequest({ conversationId: sessionId, message: "Oui" })
    );

    expect(response.status).toBe(504);
  });

  it("should return appropriate error on Claude API error", async () => {
    mockCreate.mockRejectedValueOnce(new MockAPIError(429));

    const response = await POST(
      createRequest({ conversationId: sessionId, message: "Oui" })
    );

    expect(response.status).toBe(429);
  });

  it("should return 500 on unexpected error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Unexpected"));

    const response = await POST(
      createRequest({ conversationId: sessionId, message: "Oui" })
    );

    expect(response.status).toBe(500);
  });
});
