"use client";

import React from "react";
import type { VoiceFlowStep } from "@/lib/errors";

export type FlowStatus = "idle" | VoiceFlowStep | "playing";

interface StepConfig {
  key: VoiceFlowStep | "playing";
  label: string;
  icon: React.ReactNode;
}

const STEPS: StepConfig[] = [
  {
    key: "capture",
    label: "Enregistrement",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z"
          fill="currentColor"
        />
        <path
          d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-2.06A9 9 0 0 0 21 11h-2Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    key: "transcription",
    label: "Transcription",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M1 12h2l3-6 4 12 4-8 3 4h6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "processing",
    label: "Reflexion",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7Z"
          fill="currentColor"
        />
        <path d="M9 21h6M10 19v2M14 19v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "playing",
    label: "Lecture",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 9v6h4l5 5V4L7 9H3Z"
          fill="currentColor"
        />
        <path
          d="M16.5 7.5a5 5 0 0 1 0 9M19 5a8.5 8.5 0 0 1 0 14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export interface ProgressIndicatorsProps {
  currentStep: FlowStatus;
}

function isStepActive(currentStep: FlowStatus, stepKey: string): boolean {
  if (currentStep === "idle") return false;
  if (currentStep === "synthesis") {
    return stepKey === "playing";
  }
  return currentStep === stepKey;
}

function isStepCompleted(currentStep: FlowStatus, stepIndex: number): boolean {
  if (currentStep === "idle") return false;
  const stepOrder: FlowStatus[] = ["capture", "transcription", "processing", "synthesis", "playing"];
  const currentIndex = stepOrder.indexOf(currentStep === "synthesis" ? "playing" : currentStep);
  return stepIndex < currentIndex;
}

export function ProgressIndicators({ currentStep }: ProgressIndicatorsProps) {
  if (currentStep === "idle") return null;

  return (
    <div
      role="status"
      aria-label="Progression du flux vocal"
      data-testid="progress-indicators"
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "1.5rem",
        margin: "1.5rem 0",
      }}
    >
      {STEPS.map((step, index) => {
        const active = isStepActive(currentStep, step.key);
        const completed = isStepCompleted(currentStep, index);

        return (
          <div
            key={step.key}
            data-testid={`step-${step.key}`}
            data-active={active}
            data-completed={completed}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
              opacity: active ? 1 : completed ? 0.6 : 0.3,
              color: active ? "#2563eb" : completed ? "#16a34a" : "#9ca3af",
              transition: "all 0.3s ease",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active
                  ? "#dbeafe"
                  : completed
                    ? "#dcfce7"
                    : "#f3f4f6",
                border: `2px solid ${active ? "#2563eb" : completed ? "#16a34a" : "#e5e7eb"}`,
                transition: "all 0.3s ease",
                animation: active ? "pulse 1.5s ease-in-out infinite" : "none",
              }}
            >
              {step.icon}
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: active ? 600 : 400,
                transition: "all 0.3s ease",
              }}
            >
              {step.label}
            </span>
          </div>
        );
      })}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
