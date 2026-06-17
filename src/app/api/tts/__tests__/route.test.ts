import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// We need to dynamically import the route after setting env vars
async function importRoute() {
  vi.resetModules();
  const mod = await import("../route");
  return mod;
}

function createRequestWithText(text: string): NextRequest {
  const request = new NextRequest("http://localhost:3000/api/tts", {
    method: "POST",
    body: JSON.stringify({ text }),
    headers: { "Content-Type": "application/json" },
  });
  return request;
}

function createRequestWithoutText(): NextRequest {
  const request = new NextRequest("http://localhost:3000/api/tts", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });
  return request;
}

describe("POST /api/tts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELEVENLABS_API_KEY = "test-api-key";
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
  });

  // AC: Clé API ElevenLabs TTS stockée uniquement en variable d'environnement serveur
  it("should return 500 when ELEVENLABS_API_KEY is not configured", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    const { POST } = await importRoute();

    const request = createRequestWithText("Bonjour");
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("ELEVENLABS_API_KEY not configured");
  });

  // AC: API route /api/tts accepte le texte de réponse en POST
  it("should return 400 when no text is provided", async () => {
    const { POST } = await importRoute();

    const request = createRequestWithoutText();
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Text is required");
  });

  it("should return 400 when text is not a string", async () => {
    const { POST } = await importRoute();

    const request = new NextRequest("http://localhost:3000/api/tts", {
      method: "POST",
      body: JSON.stringify({ text: 123 }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Text is required");
  });

  // AC: Données audio retournées en format approprié
  it("should return audio data with correct content type on success", async () => {
    const { POST } = await importRoute();

    const fakeAudio = new ArrayBuffer(100);
    mockFetch.mockResolvedValueOnce(
      new Response(fakeAudio, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    );

    const request = createRequestWithText("Bonjour, comment puis-je vous aider ?");
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBe(100);
  });

  // Verify API key is sent server-side to ElevenLabs (ADR-1)
  it("should send API key to ElevenLabs via xi-api-key header", async () => {
    const { POST } = await importRoute();

    mockFetch.mockResolvedValueOnce(
      new Response(new ArrayBuffer(10), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    );

    const request = createRequestWithText("Test");
    await POST(request);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("https://api.elevenlabs.io/v1/text-to-speech/");
    expect(options.headers["xi-api-key"]).toBe("test-api-key");
  });

  it("should send correct TTS parameters to ElevenLabs", async () => {
    const { POST } = await importRoute();

    mockFetch.mockResolvedValueOnce(
      new Response(new ArrayBuffer(10), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    );

    const request = createRequestWithText("Bonjour");
    await POST(request);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.text).toBe("Bonjour");
    expect(body.model_id).toBe("eleven_multilingual_v2");
    expect(body.voice_settings).toEqual({
      stability: 0.6,
      similarity_boost: 0.8,
      style: 0.3,
    });
  });

  // AC: Gestion d'erreur avec messages appropriés (IMP-11 / ADR-3)
  it("should return typed service unavailable error when ElevenLabs returns 503", async () => {
    const { POST } = await importRoute();

    mockFetch.mockResolvedValueOnce(
      new Response("Service unavailable", { status: 503 })
    );

    const request = createRequestWithText("Bonjour");
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("TTS_SYNTHESIS_SERVICE_UNAVAILABLE");
    expect(body.error.type).toBe("TTS_SYNTHESIS");
    expect(body.error.message).toBeTruthy();
    expect(body.error.suggestions.length).toBeGreaterThan(0);
  });

  it("should return typed default error on unexpected errors", async () => {
    const { POST } = await importRoute();

    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const request = createRequestWithText("Bonjour");
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("TTS_SYNTHESIS_FAILED");
    expect(body.error.type).toBe("TTS_SYNTHESIS");
  });

  // AC: Timeout configuré pour les appels ElevenLabs TTS
  it("should return typed timeout error when ElevenLabs call times out", async () => {
    const { POST } = await importRoute();

    mockFetch.mockImplementationOnce(
      (_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      }
    );

    vi.useFakeTimers();
    const request = createRequestWithText("Bonjour");
    const responsePromise = POST(request);

    await vi.advanceTimersByTimeAsync(31_000);

    const response = await responsePromise;
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.error.code).toBe("TTS_SYNTHESIS_TIMEOUT");
    expect(body.error.type).toBe("TTS_SYNTHESIS");

    vi.useRealTimers();
  });

  it("should return typed quota error when ElevenLabs returns 429", async () => {
    const { POST } = await importRoute();

    mockFetch.mockResolvedValueOnce(
      new Response("rate limit exceeded", { status: 429 })
    );

    const request = createRequestWithText("Bonjour");
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("TTS_SYNTHESIS_QUOTA_EXCEEDED");
    expect(body.error.type).toBe("TTS_SYNTHESIS");
  });

  it("should return typed text too long error when ElevenLabs rejects long text", async () => {
    const { POST } = await importRoute();

    mockFetch.mockResolvedValueOnce(
      new Response('{"detail": "text_too_long: Text exceeds maximum length"}', { status: 422 })
    );

    const request = createRequestWithText("A".repeat(10000));
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("TTS_SYNTHESIS_TEXT_TOO_LONG");
    expect(body.error.type).toBe("TTS_SYNTHESIS");
  });

  it("should pass abort signal to fetch call", async () => {
    const { POST } = await importRoute();

    mockFetch.mockResolvedValueOnce(
      new Response(new ArrayBuffer(10), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    );

    const request = createRequestWithText("Test");
    await POST(request);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});
