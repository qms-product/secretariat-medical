"use client";

import React from "react";

export interface TranscriptDisplayProps {
  transcript: string;
}

export function TranscriptDisplay({ transcript }: TranscriptDisplayProps) {
  if (!transcript) return null;

  return (
    <div
      data-testid="transcript-display"
      role="region"
      aria-label="Transcription de votre message"
      style={{
        margin: "1rem 0",
        padding: "1rem",
        backgroundColor: "#f0f4f8",
        borderRadius: 8,
        borderLeft: "4px solid #3498db",
      }}
    >
      <p
        data-testid="transcript-label"
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#2980b9",
          textTransform: "uppercase",
          marginBottom: "0.5rem",
        }}
      >
        Vous
      </p>
      <p
        data-testid="transcript-text"
        style={{
          color: "#2c3e50",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          margin: 0,
        }}
      >
        {transcript}
      </p>
    </div>
  );
}
