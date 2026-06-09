import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/stt — Speech-to-Text via ElevenLabs
 * Receives audio blob, returns transcribed text.
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

    const response = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: elevenLabsForm,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs STT error:", errorText);
      return NextResponse.json(
        { error: "Transcription service error" },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error("STT route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
