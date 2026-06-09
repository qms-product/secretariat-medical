import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

async function importRoute() {
  vi.resetModules();

  // Re-apply the Anthropic mock after resetModules
  vi.doMock("@anthropic-ai/sdk", () => ({
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  }));

  const mod = await import("../route");
  return mod;
}

function createRequestWithText(text: string): NextRequest {
  const request = new NextRequest("http://localhost:3000/api/llm", {
    method: "POST",
    body: JSON.stringify({ text }),
    headers: { "Content-Type": "application/json" },
  });
  return request;
}

function createRequestWithMessages(
  messages: { role: string; content: string }[]
): NextRequest {
  const request = new NextRequest("http://localhost:3000/api/llm", {
    method: "POST",
    body: JSON.stringify({ messages }),
    headers: { "Content-Type": "application/json" },
  });
  return request;
}

function createEmptyRequest(): NextRequest {
  const request = new NextRequest("http://localhost:3000/api/llm", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });
  return request;
}

const mockClaudeResponse = {
  content: [{ type: "text", text: "Bonjour, le cabinet est ouvert de 8h a 18h." }],
};

describe("POST /api/llm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    mockCreate.mockResolvedValue(mockClaudeResponse);
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  // AC: Clé API Anthropic stockée uniquement en variable d'environnement serveur
  it("should return 500 when ANTHROPIC_API_KEY is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { POST } = await importRoute();

    const request = createRequestWithText("Bonjour");
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("ANTHROPIC_API_KEY not configured");
  });

  // AC: API route /api/llm accepte le texte transcrit en POST
  it("should accept text in POST body and return a reply", async () => {
    const { POST } = await importRoute();

    const request = createRequestWithText("Quels sont vos horaires ?");
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reply).toBe("Bonjour, le cabinet est ouvert de 8h a 18h.");
  });

  // AC: API route /api/llm accepte le texte transcrit en POST (messages format)
  it("should accept messages array in POST body", async () => {
    const { POST } = await importRoute();

    const request = createRequestWithMessages([
      { role: "user", content: "Bonjour" },
    ]);
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reply).toBe("Bonjour, le cabinet est ouvert de 8h a 18h.");
  });

  it("should return 400 when neither text nor messages is provided", async () => {
    const { POST } = await importRoute();

    const request = createEmptyRequest();
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Text or messages array is required");
  });

  // AC: Réponse textuelle retournée en JSON
  it("should return reply as JSON with { reply } shape", async () => {
    const { POST } = await importRoute();

    const request = createRequestWithText("Bonjour");
    const response = await POST(request);
    const body = await response.json();

    expect(body).toHaveProperty("reply");
    expect(typeof body.reply).toBe("string");
  });

  // AC: Contexte fictif injecté dans le prompt Claude
  it("should inject fictitious context via system prompt", async () => {
    const { POST } = await importRoute();

    const request = createRequestWithText("Bonjour");
    await POST(request);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain("Cabinet Medical Fictif");
    expect(callArgs.system).toContain("Creneaux disponibles");
    expect(callArgs.system).toContain("JAMAIS");
  });

  // AC: Gestion d'erreur avec messages appropriés
  it("should return 502 when Claude API returns an error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API error"));
    const { POST } = await importRoute();

    const request = createRequestWithText("Bonjour");
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("Processing service error");
  });

  // AC: Timeout configuré pour les appels Claude
  it("should pass an abort signal to the Anthropic client", async () => {
    const { POST } = await importRoute();

    const request = createRequestWithText("Bonjour");
    await POST(request);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callOptions = mockCreate.mock.calls[0][1];
    expect(callOptions).toHaveProperty("signal");
    expect(callOptions.signal).toBeInstanceOf(AbortSignal);
  });

  // AC: Timeout configuré pour les appels Claude
  it("should return 504 when Claude API call times out", async () => {
    const abortError = new Error("This operation was aborted");
    abortError.name = "AbortError";
    mockCreate.mockRejectedValueOnce(abortError);
    const { POST } = await importRoute();

    const request = createRequestWithText("Bonjour");
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.error).toBe("Processing service timeout");
  });

  // Security: API key never exposed in response
  it("should never include the API key in the response", async () => {
    const { POST } = await importRoute();

    const request = createRequestWithText("Bonjour");
    const response = await POST(request);
    const bodyText = await response.clone().text();

    expect(bodyText).not.toContain("test-anthropic-key");
  });
});
