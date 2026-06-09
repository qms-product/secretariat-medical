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

function createRequestWithAudio(): NextRequest {
  const formData = new FormData();
  const audioBlob = new Blob(["fake-audio-data"], { type: "audio/webm" });
  formData.append("audio", audioBlob, "recording.webm");

  const request = new NextRequest("http://localhost:3000/api/stt", {
    method: "POST",
  });
  vi.spyOn(request, "formData").mockResolvedValue(formData);
  return request;
}

function createRequestWithoutAudio(): NextRequest {
  const formData = new FormData();
  const request = new NextRequest("http://localhost:3000/api/stt", {
    method: "POST",
  });
  vi.spyOn(request, "formData").mockResolvedValue(formData);
  return request;
}

describe("POST /api/stt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELEVENLABS_API_KEY = "test-api-key";
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
  });

  // AC: Clé API ElevenLabs stockée uniquement en variable d'environnement serveur
  it("should return 500 when ELEVENLABS_API_KEY is not configured", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    const { POST } = await importRoute();

    const request = createRequestWithAudio();
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("ELEVENLABS_API_KEY not configured");
  });

  // AC: API route /api/stt accepte les données audio en POST
  it("should return 400 when no audio file is provided", async () => {
    const { POST } = await importRoute();

    const request = createRequestWithoutAudio();
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("No audio file provided");
  });

  // AC: Transcription textuelle retournée en JSON
  it("should return transcription text on success", async () => {
    const { POST } = await importRoute();

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "Bonjour, je voudrais un rendez-vous" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = createRequestWithAudio();
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.text).toBe("Bonjour, je voudrais un rendez-vous");
  });

  // Verify API key is sent server-side to ElevenLabs (ADR-1)
  it("should send API key to ElevenLabs via xi-api-key header", async () => {
    const { POST } = await importRoute();

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = createRequestWithAudio();
    await POST(request);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(options.headers["xi-api-key"]).toBe("test-api-key");
  });

  // AC: Gestion d'erreur avec messages appropriés (IMP-9)
  it("should return service unavailable error when ElevenLabs returns 503", async () => {
    const { POST } = await importRoute();

    mockFetch.mockResolvedValueOnce(
      new Response("Service unavailable", { status: 503 })
    );

    const request = createRequestWithAudio();
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("STT_TRANSCRIPTION_SERVICE_UNAVAILABLE");
    expect(body.error.type).toBe("STT_TRANSCRIPTION");
    expect(body.error.suggestions.length).toBeGreaterThan(0);
  });

  it("should return typed error on unexpected errors", async () => {
    const { POST } = await importRoute();

    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const request = createRequestWithAudio();
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("STT_TRANSCRIPTION_FAILED");
    expect(body.error.type).toBe("STT_TRANSCRIPTION");
  });

  // AC: Timeout configuré pour les appels ElevenLabs (IMP-9)
  it("should return timeout error when ElevenLabs call times out", async () => {
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
    const request = createRequestWithAudio();
    const responsePromise = POST(request);

    await vi.advanceTimersByTimeAsync(31_000);

    const response = await responsePromise;
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.error.code).toBe("STT_TRANSCRIPTION_TIMEOUT");
    expect(body.error.type).toBe("STT_TRANSCRIPTION");

    vi.useRealTimers();
  });

  it("should pass abort signal to fetch call", async () => {
    const { POST } = await importRoute();

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = createRequestWithAudio();
    await POST(request);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});
