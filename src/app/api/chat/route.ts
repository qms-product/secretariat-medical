import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { containsAppointmentAction } from "@/lib/request-validator";
import {
  VOICE_FLOW_ERRORS,
  VoiceFlowErrorType,
  mapClaudeApiError,
} from "@/lib/errors";
import { fetchAvailability } from "@/lib/calcom-availability";
import type { CalcomAvailabilityResult } from "@/lib/calcom-availability";
import { getSecureLogger } from "@/lib/secure-logger";
import { validatePatientData } from "@/lib/patient-validation";
import {
  getSession,
  updateSession,
  parseStateMarkers,
  ConversationState,
  MAX_VALIDATION_RETRIES,
  type ValidationRetryState,
} from "@/lib/conversation-state";

const CLAUDE_TIMEOUT_MS = 30_000;

/**
 * POST /api/chat — Conversational processing via Claude Sonnet
 * Receives conversation messages, returns assistant reply.
 * Error handling per IMP-10 / ADR-3.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { messages } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // IMP-19: Server-side validation — reject requests attempting to book/modify appointments
    const lastUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");
    if (
      lastUserMessage &&
      containsAppointmentAction(lastUserMessage.content)
    ) {
      return NextResponse.json({
        reply:
          "Je ne suis pas en mesure de prendre ou modifier des rendez-vous. Je peux uniquement vous informer sur les creneaux disponibles. Pour prendre rendez-vous, veuillez contacter le cabinet directement.",
      });
    }

    // IMP-35: Fetch Cal.com availability from PostgreSQL (best-effort)
    let calcomAvailability: CalcomAvailabilityResult | undefined;
    if (process.env.CALCOM_DATABASE_URL) {
      try {
        calcomAvailability = await fetchAvailability();
      } catch (error) {
        getSecureLogger().error("Failed to fetch Cal.com availability:", error);
        // Continue without availability — graceful degradation
      }
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: buildSystemPrompt(calcomAvailability),
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      },
      {
        timeout: CLAUDE_TIMEOUT_MS,
      }
    );

    const rawReply =
      response.content[0].type === "text" ? response.content[0].text : "";

    // IMP-28: Validate patient data during INFO_COLLECTION → CONFIRMATION transitions
    const { conversationId } = await request
      .clone()
      .json()
      .then((b: { conversationId?: string }) => ({
        conversationId: b.conversationId,
      }))
      .catch(() => ({ conversationId: undefined }));

    let reply = rawReply;

    if (conversationId) {
      const session = getSession(conversationId);
      if (session && session.state === ConversationState.INFO_COLLECTION) {
        const parsed = parseStateMarkers(rawReply);

        // If LLM wants to transition to CONFIRMATION, validate patient data first
        if (
          parsed.nextState === ConversationState.CONFIRMATION &&
          parsed.patientInfo
        ) {
          const validationResult = validatePatientData({
            email: parsed.patientInfo.email,
            phone: parsed.patientInfo.phone,
          });

          if (!validationResult.valid) {
            // Increment retry counters for each failing field
            const newRetries: ValidationRetryState = {
              ...session.validationRetries,
            };
            for (const error of validationResult.errors) {
              const field = error.field as keyof ValidationRetryState;
              if (field in newRetries) {
                newRetries[field]++;
              }
            }

            // Update session with patient info and retries, staying in INFO_COLLECTION
            updateSession(conversationId, {
              patientInfo: {
                ...session.patientInfo,
                ...parsed.patientInfo,
              },
              validationRetries: newRetries,
            });

            // Build a validation error context for the LLM to reformulate
            const hasExhaustedRetries = validationResult.errors.some(
              (e) =>
                newRetries[e.field as keyof ValidationRetryState] >=
                MAX_VALIDATION_RETRIES
            );

            const errorDescriptions = validationResult.errors
              .map((e) => e.message)
              .join(" ");

            const correctionHint = hasExhaustedRetries
              ? `${errorDescriptions} Vous pouvez aussi nous contacter directement au cabinet.`
              : errorDescriptions;

            // Return the cleaned reply with appended correction prompt
            reply = `${parsed.cleanReply}\n\n${correctionHint}`;

            return NextResponse.json({
              reply,
              conversationId,
              validationErrors: validationResult.errors,
            });
          }
        }
      }
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const logger = getSecureLogger();

    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      logger.error("Claude API timeout after", CLAUDE_TIMEOUT_MS, "ms");
      const errorInfo =
        VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING].timeout;
      return NextResponse.json({ error: errorInfo }, { status: 504 });
    }

    if (error instanceof Anthropic.APIError) {
      const status = error.status;
      const body =
        typeof error.message === "string" ? error.message : String(error);
      logger.error(`Claude API error [${status}]:`, body);

      const errorInfo = mapClaudeApiError(status, body);

      const httpStatus =
        status === 429
          ? 429
          : status === 529 || status === 503 || status === 502 || status === 504
            ? 503
            : 502;

      return NextResponse.json({ error: errorInfo }, { status: httpStatus });
    }

    logger.error("Chat route error:", error);
    const errorInfo =
      VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING].default;
    return NextResponse.json({ error: errorInfo }, { status: 500 });
  }
}
