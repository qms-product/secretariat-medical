"use client";

import React from "react";
import { VoiceFlowErrorType, type VoiceFlowErrorInfo } from "@/lib/errors";

const STEP_LABELS: Record<VoiceFlowErrorType, string> = {
  [VoiceFlowErrorType.AUDIO_CAPTURE]: "Capture audio",
  [VoiceFlowErrorType.STT_TRANSCRIPTION]: "Transcription",
  [VoiceFlowErrorType.CLAUDE_PROCESSING]: "Traitement",
  [VoiceFlowErrorType.TTS_SYNTHESIS]: "Synthese vocale",
  [VoiceFlowErrorType.AUDIO_PLAYBACK]: "Lecture audio",
};

export interface ErrorDisplayProps {
  error: VoiceFlowErrorInfo;
  onRetry: () => void;
  isRetrying: boolean;
}

export function ErrorDisplay({ error, onRetry, isRetrying }: ErrorDisplayProps) {
  const stepLabel = STEP_LABELS[error.type];

  return (
    <div
      role="alert"
      style={{
        border: "1px solid #e74c3c",
        borderRadius: 8,
        padding: "1rem",
        margin: "1rem 0",
        backgroundColor: "#fdf0ef",
      }}
    >
      <p
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#c0392b",
          textTransform: "uppercase",
          marginBottom: "0.25rem",
        }}
        data-testid="error-step-label"
      >
        Erreur — {stepLabel}
      </p>
      <p style={{ color: "#c0392b", fontWeight: 500 }} data-testid="error-message">
        {error.message}
      </p>
      {error.suggestions.length > 0 && (
        <ul
          style={{
            fontSize: "0.875rem",
            color: "#666",
            marginTop: "0.5rem",
            paddingLeft: "1.25rem",
          }}
          data-testid="error-suggestions"
        >
          {error.suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      <button
        onClick={onRetry}
        disabled={isRetrying}
        style={{
          marginTop: "0.75rem",
          padding: "0.5rem 1rem",
          backgroundColor: isRetrying ? "#bdc3c7" : "#e74c3c",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: isRetrying ? "not-allowed" : "pointer",
        }}
        data-testid="retry-button"
      >
        {isRetrying ? "Nouvelle tentative en cours..." : "Reessayer"}
      </button>
    </div>
  );
}
