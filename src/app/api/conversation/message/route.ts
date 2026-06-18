import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/system-prompt";
import {
  getSession,
  updateSession,
  buildStatePrompt,
  parseStateMarkers,
  ConversationState,
  isTerminalState,
} from "@/lib/conversation-state";
import {
  resolveSlotDetails,
  formatAppointmentConfirmation,
} from "@/lib/appointment-confirmation";
import {
  VOICE_FLOW_ERRORS,
  VoiceFlowErrorType,
  mapClaudeApiError,
} from "@/lib/errors";
import { completeFlowTracking } from "@/lib/flow-duration-monitor";
import { getSecureLogger } from "@/lib/secure-logger";
import { CalcomService } from "@/lib/calcom-service";
import { CalcomDatabaseError } from "@/lib/calcom-db-errors";

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

  // IMP-36: Block messages in NO_SLOTS_AVAILABLE terminal state
  if (session.state === ConversationState.NO_SLOTS_AVAILABLE) {
    return NextResponse.json(
      { error: "Cette conversation est terminee (aucun creneau disponible)" },
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
        model: "claude-sonnet-4-5-20250929",
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

    // IMP-37: Complete flow tracking when reaching a terminal state
    if (isTerminalState(updatedSession.state)) {
      completeFlowTracking(conversationId, updatedSession.state);
    }

    // IMP-34: Generate vocal confirmation and create booking when entering BOOKING state
    let confirmationText: string | undefined;
    let bookingResult: { id: number; uid: string } | undefined;

    if (updatedSession.state === ConversationState.BOOKING && updatedSession.selectedSlot) {
      const details = resolveSlotDetails(updatedSession.selectedSlot);
      if (details) {
        confirmationText = formatAppointmentConfirmation(details);
      }

      // Actually create the booking in Cal.com PostgreSQL
      const { patientInfo: pi } = updatedSession;
      if (pi.name && pi.email) {
        try {
          bookingResult = await createCalcomBooking(
            updatedSession.selectedSlot,
            pi,
            details,
          );
        } catch (bookingError) {
          const logger = getSecureLogger();
          logger.error("Failed to create Cal.com booking:", bookingError);
          // Don't fail the conversation — the confirmation was already given vocally.
          // The booking error is logged for manual follow-up.
        }
      }
    }

    return NextResponse.json({
      conversationId: updatedSession.id,
      state: updatedSession.state,
      reply: confirmationText ?? cleanReply,
      patientInfo: updatedSession.patientInfo,
      selectedSlot: updatedSession.selectedSlot,
      ...(confirmationText ? { confirmationText } : {}),
      ...(bookingResult ? { booking: bookingResult } : {}),
    });
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
          : status === 529 ||
              status === 503 ||
              status === 502 ||
              status === 504
            ? 503
            : 502;
      return NextResponse.json({ error: errorInfo }, { status: httpStatus });
    }

    logger.error("Conversation message error:", error);
    const errorInfo =
      VOICE_FLOW_ERRORS[VoiceFlowErrorType.CLAUDE_PROCESSING].default;
    return NextResponse.json({ error: errorInfo }, { status: 500 });
  }
}

// ─── Cal.com booking helper ─────────────────────────────────────────────────

import type { AppointmentDetails } from "@/lib/appointment-confirmation";
import type { PatientInfo } from "@/lib/conversation-state";

/**
 * Creates a booking + attendee in Cal.com PostgreSQL.
 *
 * Resolves the event type from CAL_COM_EVENT_TYPE_ID, builds start/end times
 * from the selected slot, and inserts into Booking + Attendee tables.
 */
async function createCalcomBooking(
  selectedSlot: string,
  patientInfo: PatientInfo,
  slotDetails: AppointmentDetails | undefined,
): Promise<{ id: number; uid: string }> {
  const eventTypeIdStr = process.env.CAL_COM_EVENT_TYPE_ID;
  if (!eventTypeIdStr) {
    throw new Error("CAL_COM_EVENT_TYPE_ID not configured — booking skipped");
  }

  const service = new CalcomService();
  const eventTypeId = parseInt(eventTypeIdStr, 10);

  // Resolve event type for duration and title
  const eventTypes = await service.getEventTypes();
  const eventType = eventTypes.find((et) => et.id === eventTypeId);
  if (!eventType) {
    throw new Error(`EventType id=${eventTypeId} not found in Cal.com DB`);
  }

  // Build start/end from slot details or raw slot string
  let startTime: Date;
  if (slotDetails) {
    startTime = new Date(`${slotDetails.date}T${slotDetails.time}:00`);
  } else {
    // Fallback: try to parse ISO-like date from the slot string
    const dateMatch = selectedSlot.match(/(\d{4}-\d{2}-\d{2})/);
    const timeMatch = selectedSlot.match(/(\d{2}:\d{2})/);
    if (dateMatch && timeMatch) {
      startTime = new Date(`${dateMatch[1]}T${timeMatch[1]}:00`);
    } else {
      throw new Error(`Cannot parse slot time from: ${selectedSlot}`);
    }
  }

  const endTime = new Date(startTime.getTime() + eventType.length * 60_000);
  const uid = crypto.randomUUID();

  const booking = await service.createBooking({
    uid,
    title: `${eventType.title} - ${patientInfo.name}`,
    startTime,
    endTime,
    eventTypeId,
  });

  await service.createAttendee({
    bookingId: booking.id,
    name: patientInfo.name!,
    email: patientInfo.email!,
    phone: patientInfo.phone,
    timeZone: "Europe/Paris",
    locale: "fr",
  });

  return { id: booking.id, uid: booking.uid };
}
