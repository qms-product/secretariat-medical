import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/system-prompt";
import {
  createSession,
  getSession,
  buildStatePrompt,
  parseStateMarkers,
  updateSession,
  ConversationState,
} from "@/lib/conversation-state";
import {
  VOICE_FLOW_ERRORS,
  VoiceFlowErrorType,
  mapClaudeApiError,
} from "@/lib/errors";

const CLAUDE_TIMEOUT_MS = 30_000;

/**
 * POST /api/conversation/start — Initialize a new conversation in GREETING state (IMP-23)
 * Returns the greeting message along with conversation metadata.
 */
export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const session = createSession();

    const systemPrompt =
      buildSystemPrompt() + "\n\n" + buildStatePrompt(session);

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: "Bonjour",
          },
        ],
      },
      { timeout: CLAUDE_TIMEOUT_MS }
    );

    const rawReply =
      response.content[0].type === "text" ? response.content[0].text : "";

    const { cleanReply, nextState, patientInfo, selectedSlot } =
      parseStateMarkers(rawReply);

    // Apply state transition if valid
    if (nextState) {
      updateSession(session.id, {
        state: nextState,
        messages: [
          { role: "user", content: "Bonjour" },
          { role: "assistant", content: cleanReply },
        ],
        ...(patientInfo && { patientInfo }),
        ...(selectedSlot && { selectedSlot }),
      });
    } else {
      // Default: transition from GREETING to SLOT_PROPOSAL
      updateSession(session.id, {
        state: ConversationState.SLOT_PROPOSAL,
        messages: [
          { role: "user", content: "Bonjour" },
          { role: "assistant", content: cleanReply },
        ],
      });
    }

    const updatedSession = getSession(session.id);

    return NextResponse.json({
      conversationId: session.id,
      state: updatedSession?.state ?? ConversationState.SLOT_PROPOSAL,
      reply: cleanReply,
      patientInfo: updatedSession?.patientInfo ?? {},
      selectedSlot: updatedSession?.selectedSlot,
    });
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      console.error("Claude API timeout after", CLAUDE_TIMEOUT_MS, "ms");
      const errorInfo =
        VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING].timeout;
      return NextResponse.json({ error: errorInfo }, { status: 504 });
    }

    if (error instanceof Anthropic.APIError) {
      const status = error.status;
      const body =
        typeof error.message === "string" ? error.message : String(error);
      console.error(`Claude API error [${status}]:`, body);
      const errorInfo = mapClaudeApiError(status, body);
      const httpStatus =
        status === 429
          ? 429
          : status === 529 ||
              status === 503 ||
              status === 502 ||
              status === 504
            ? 503
            : 502;
      return NextResponse.json({ error: errorInfo }, { status: httpStatus });
    }

    console.error("Conversation start error:", error);
    const errorInfo =
      VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING].default;
    return NextResponse.json({ error: errorInfo }, { status: 500 });
  }
}
