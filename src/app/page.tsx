"use client";

import { useState, useRef, useCallback } from "react";
import type { VoiceFlowStep } from "@/lib/errors";

type FlowStatus = "idle" | VoiceFlowStep | "playing";

export default function Home() {
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setError("");
    setTranscript("");
    setResponse("");

    try {
      setStatus("capture");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
    } catch {
      setError(
        "Erreur lors de la capture audio. Verifiez que votre microphone est autorise."
      );
      setStatus("idle");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state !== "recording") return;

    const audioBlob = await new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      };
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    });

    // Step 1: Transcription (STT)
    try {
      setStatus("transcription");
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const sttRes = await fetch("/api/stt", { method: "POST", body: formData });
      if (!sttRes.ok) throw new Error("STT failed");
      const { text } = await sttRes.json();
      setTranscript(text);

      // Step 2: Processing (LLM)
      setStatus("processing");
      const newHistory = [
        ...conversationHistory,
        { role: "user" as const, content: text },
      ];

      const llmRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });
      if (!llmRes.ok) throw new Error("LLM failed");
      const { reply } = await llmRes.json();
      setResponse(reply);

      setConversationHistory([
        ...newHistory,
        { role: "assistant", content: reply },
      ]);

      // Step 3: Synthesis (TTS)
      setStatus("synthesis");
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      if (!ttsRes.ok) throw new Error("TTS failed");

      // Step 4: Playing audio
      setStatus("playing");
      const audioData = await ttsRes.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => setStatus("idle");
      source.start();
    } catch (err) {
      const step =
        status === "transcription"
          ? "transcription"
          : status === "processing"
            ? "processing"
            : "synthesis";
      const messages: Record<string, string> = {
        transcription:
          "Erreur lors de la transcription. Le service est temporairement indisponible.",
        processing:
          "Erreur lors du traitement. Le service est temporairement indisponible.",
        synthesis:
          "Erreur lors de la synthese vocale. Le service est temporairement indisponible.",
      };
      setError(messages[step] || String(err));
      setStatus("idle");
    }
  }, [conversationHistory, status]);

  const statusLabels: Record<FlowStatus, string> = {
    idle: "",
    capture: "Enregistrement en cours...",
    transcription: "Transcription en cours...",
    processing: "Reflexion en cours...",
    synthesis: "Synthese vocale en cours...",
    playing: "Lecture de la reponse...",
  };

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "2rem" }}>
      <h1>Assistant Vocal - Secretariat Medical</h1>
      <p style={{ color: "#666", fontSize: "0.875rem" }}>
        Donnees fictives uniquement — demonstration
      </p>

      <div style={{ margin: "2rem 0" }}>
        {status === "idle" ? (
          <button onClick={startRecording} style={{ padding: "1rem 2rem", fontSize: "1.1rem" }}>
            Appuyer pour parler
          </button>
        ) : status === "capture" ? (
          <button onClick={stopRecording} style={{ padding: "1rem 2rem", fontSize: "1.1rem", background: "#e74c3c", color: "white", border: "none", borderRadius: 4 }}>
            Arreter l&apos;enregistrement
          </button>
        ) : (
          <p>{statusLabels[status]}</p>
        )}
      </div>

      {error && (
        <div role="alert" style={{ color: "#e74c3c", margin: "1rem 0" }}>
          {error}
        </div>
      )}

      {transcript && (
        <div style={{ margin: "1rem 0" }}>
          <strong>Vous :</strong> {transcript}
        </div>
      )}

      {response && (
        <div style={{ margin: "1rem 0" }}>
          <strong>Assistant :</strong> {response}
        </div>
      )}
    </main>
  );
}
