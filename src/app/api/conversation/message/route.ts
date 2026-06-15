import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/system-prompt";
import {
  getSession,
  updateSession,
  buildStatePrompt,
  parseStateMarkers,
  ConversationState,
} from "@/lib/conversation-state";
import {
  VOICE_FLOW_ERRORS,
  VoiceFlowErrorType,
  mapClaudeApiError,
} from "@/lib/errors";

const CLAUDE_TIMEOUT_MS = 30_000;

/**
 * POST /api/conversation/message — Process a user message within an existing conversation (IMP-23)
 * Body: { conversationId: string, message: string }
 * Returns the assistant reply with updated state and metadata.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: { conversationId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requete JSON invalide" },
      { status: 400 }
    );
  }

  const { conversationId, message } = body;

  if (!conversationId || typeof conversationId !== "string") {
    return NextResponse.json(
      { error: "Le champ 'conversationId' est requis" },
      { status: 400 }
    );
  }

  if (!message || typeof message !== "string" || message.trim() === "") {
    return NextResponse.json(
      { error: "Le champ 'message' est requis" },
      { status: 400 }
    );
  }

  const session = getSession(conversationId);
  if (!session) {
    return NextResponse.json(
      { error: "Conversation introuvable ou expiree" },
      { status: 404 }
    );
  }

  if (session.state === ConversationState.BOOKING) {
    return NextResponse.json(
      { error: "Cette conversation est terminee (etat BOOKING)" },
      { status: 400 }
    );
  }

  try {
    const systemPrompt =
      buildSystemPrompt() + "\n\n" + buildStatePrompt(session);

    const conversationMessages: Anthropic.MessageParam[] = [
      ...session.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message.trim() },
    ];

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: conversationMessages,
      },
      { timeout: CLAUDE_TIMEOUT_MS }
    );

    const rawReply =
      response.content[0].type === "text" ? response.content[0].text : "";

    const { cleanReply, nextState, patientInfo, selectedSlot } =
      parseStateMarkers(rawReply);

    const newMessages = [
      ...session.messages,
      { role: "user" as const, content: message.trim() },
      { role: "assistant" as const, content: cleanReply },
    ];

    const updates: Parameters<typeof updateSession>[1] = {
      messages: newMessages,
    };

    if (nextState) {
      updates.state = nextState;
    }

    if (patientInfo) {
      updates.patientInfo = { ...session.patientInfo, ...patientInfo };
    }

    if (selectedSlot) {
      updates.selectedSlot = selectedSlot;
    }

    const updatedSession = updateSession(conversationId, updates);

    if (!updatedSession) {
      return NextResponse.json(
        {
          error: `Transition d'etat invalide depuis ${session.state}${nextState ? ` vers ${nextState}` : ""}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      conversationId: updatedSession.id,
      state: updatedSession.state,
      reply: cleanReply,
      patientInfo: updatedSession.patientInfo,
      selectedSlot: updatedSession.selectedSlot,
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

    console.error("Conversation message error:", error);
    const errorInfo =
      VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING].default;
    return NextResponse.json({ error: errorInfo }, { status: 500 });
  }
}
