import { NextRequest, NextResponse } from "next/server";
import {
  VOICE_FLOW_ERRORS,
  VoiceFlowErrorType,
  mapElevenLabsSttError,
} from "@/lib/errors";

const ELEVENLABS_TIMEOUT_MS = 30_000;

/**
 * POST /api/stt — Speech-to-Text via ElevenLabs
 * Receives audio blob, returns transcribed text.
 * Error handling per IMP-9 / ADR-3.
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
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    const elevenLabsForm = new FormData();
    elevenLabsForm.append("file", audioFile, "recording.webm");
    elevenLabsForm.append("model_id", "scribe_v1");
    elevenLabsForm.append("language_code", "fra");

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      ELEVENLABS_TIMEOUT_MS
    );

    let response: Response;
    try {
      response = await fetch(
        "https://api.elevenlabs.io/v1/speech-to-text",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
          },
          body: elevenLabsForm,
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `ElevenLabs STT error [${response.status}]:`,
        errorText
      );

      const errorInfo = mapElevenLabsSttError(response.status, errorText);

      const httpStatus =
        response.status === 429
          ? 429
          : response.status === 422 || response.status === 415
            ? 400
            : response.status === 503 ||
                response.status === 502 ||
                response.status === 504
              ? 503
              : 502;

      return NextResponse.json({ error: errorInfo }, { status: httpStatus });
    }

    const data = await response.json();
    return NextResponse.json({ text: data.text });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error("ElevenLabs STT timeout after", ELEVENLABS_TIMEOUT_MS, "ms");
      const errorInfo =
        VOICE_FLOW_ERRORS[VoiceFlowErrorType.STT_TRANSCRIPTION].timeout;
      return NextResponse.json({ error: errorInfo }, { status: 504 });
    }
    console.error("STT route error:", error);
    const errorInfo =
      VOICE_FLOW_ERRORS[VoiceFlowErrorType.STT_TRANSCRIPTION].default;
    return NextResponse.json({ error: errorInfo }, { status: 500 });
  }
}
