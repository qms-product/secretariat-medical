import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/system-prompt";

const ANTHROPIC_TIMEOUT_MS = 30_000;

/**
 * POST /api/llm — Conversational processing via Claude Sonnet
 * Receives transcribed text, injects fictitious context, returns Claude reply.
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
    const body = await request.json();
    const { text, messages } = body;

    if (!text && (!Array.isArray(messages) || messages.length === 0)) {
      return NextResponse.json(
        { error: "Text or messages array is required" },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey });

    const conversationMessages: Anthropic.MessageParam[] = messages
      ? messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      : [{ role: "user" as const, content: text }];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

    let response: Anthropic.Message;
    try {
      response = await client.messages.create(
        {
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: buildSystemPrompt(),
          messages: conversationMessages,
        },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const reply =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        ("code" in error && error.code === "ABORT_ERR"))
    ) {
      console.error("Anthropic API timeout");
      return NextResponse.json(
        { error: "Processing service timeout" },
        { status: 504 }
      );
    }
    console.error("LLM route error:", error);
    return NextResponse.json(
      { error: "Processing service error" },
      { status: 502 }
    );
  }
}
