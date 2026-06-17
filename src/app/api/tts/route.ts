import { NextRequest, NextResponse } from "next/server";
import {
  VOICE_FLOW_ERRORS,
  VoiceFlowErrorType,
  mapElevenLabsTtsError,
} from "@/lib/errors";
import { TTS_CONFIG, getVoiceId } from "@/lib/tts-config";

const ELEVENLABS_TIMEOUT_MS = 30_000;

/**
 * POST /api/tts — Text-to-Speech via ElevenLabs
 * Receives text, returns audio buffer.
 * Error handling per IMP-11 / ADR-3.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ELEVENLABS_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${getVoiceId()}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: TTS_CONFIG.modelId,
            voice_settings: {
              stability: TTS_CONFIG.voiceSettings.stability,
              similarity_boost: TTS_CONFIG.voiceSettings.similarity_boost,
              style: TTS_CONFIG.voiceSettings.style,
            },
          }),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `ElevenLabs TTS error [${response.status}]:`,
        errorText
      );

      const errorInfo = mapElevenLabsTtsError(response.status, errorText);

      const httpStatus =
        response.status === 429
          ? 429
          : response.status === 503 ||
              response.status === 502 ||
              response.status === 504
            ? 503
            : 502;

      return NextResponse.json({ error: errorInfo }, { status: httpStatus });
    }

    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error("ElevenLabs TTS timeout after", ELEVENLABS_TIMEOUT_MS, "ms");
      const errorInfo =
        VOICE_FLOW_ERRORS[VoiceFlowErrorType.TTS_SYNTHESIS].timeout;
      return NextResponse.json({ error: errorInfo }, { status: 504 });
    }
    console.error("TTS route error:", error);
    const errorInfo =
      VOICE_FLOW_ERRORS[VoiceFlowErrorType.TTS_SYNTHESIS].default;
    return NextResponse.json({ error: errorInfo }, { status: 500 });
  }
}
