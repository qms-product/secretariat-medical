import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/system-prompt";
import {
  VOICE_FLOW_ERRORS,
  VoiceFlowErrorType,
  mapClaudeApiError,
} from "@/lib/errors";

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

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      },
      {
        timeout: CLAUDE_TIMEOUT_MS,
      }
    );

    const reply =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply });
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
          : status === 529 || status === 503 || status === 502 || status === 504
            ? 503
            : 502;

      return NextResponse.json({ error: errorInfo }, { status: httpStatus });
    }

    console.error("Chat route error:", error);
    const errorInfo =
      VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING].default;
    return NextResponse.json({ error: errorInfo }, { status: 500 });
  }
}
