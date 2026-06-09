"use client";

import React from "react";

export interface ResponseDisplayProps {
  response: string;
}

export function ResponseDisplay({ response }: ResponseDisplayProps) {
  if (!response) return null;

  return (
    <div
      data-testid="response-display"
      role="region"
      aria-label="Reponse de l'assistant"
      style={{
        margin: "1rem 0",
        padding: "1rem",
        backgroundColor: "#f0faf0",
        borderRadius: 8,
        borderLeft: "4px solid #27ae60",
      }}
    >
      <p
        data-testid="response-label"
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#27ae60",
          textTransform: "uppercase",
          marginBottom: "0.5rem",
        }}
      >
        Assistant
      </p>
      <p
        data-testid="response-text"
        style={{
          color: "#2c3e50",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          margin: 0,
        }}
      >
        {response}
      </p>
    </div>
  );
}
