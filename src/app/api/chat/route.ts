import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/system-prompt";
import {
  VOICE_FLOW_ERRORS,
  VoiceFlowErrorType,
  mapClaudeApiError,
} from "@/lib/errors";
import { fetchAvailability } from "@/lib/calcom-availability";
import type { CalcomAvailabilityResult } from "@/lib/calcom-availability";
import {
  CalcomDatabaseError,
  getCalcomErrorVoiceResponse,
} from "@/lib/calcom-db-errors";
import { getSecureLogger } from "@/lib/secure-logger";
import { validatePatientData } from "@/lib/patient-validation";
import {
  createSession,
  getSession,
  updateSession,
  parseStateMarkers,
  buildStatePrompt,
  ConversationState,
  MAX_VALIDATION_RETRIES,
  type ValidationRetryState,
} from "@/lib/conversation-state";
import { CalcomService } from "@/lib/calcom-service";
import {
  resolveSlotDetails,
  formatAppointmentConfirmation,
} from "@/lib/appointment-confirmation";

const CLAUDE_TIMEOUT_MS = 30_000;

/**
 * POST /api/chat — Conversational processing via Claude Sonnet
 * Receives conversation messages, returns assistant reply.
 * Integrates conversation state machine for booking flow.
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
    const body = await request.json();
    const { messages, conversationId: incomingConversationId } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Create or retrieve conversation session
    let session = incomingConversationId
      ? getSession(incomingConversationId)
      : undefined;

    if (!session) {
      session = createSession();
    }

    const conversationId = session.id;

    // IMP-35: Fetch Cal.com availability from PostgreSQL
    // IMP-32: Return voice error response on Cal.com DB failure (ADR-12)
    let calcomAvailability: CalcomAvailabilityResult | undefined;
    if (process.env.CALCOM_DATABASE_URL) {
      try {
        calcomAvailability = await fetchAvailability();
      } catch (error) {
        getSecureLogger().error("Failed to fetch Cal.com availability:", error);

        if (error instanceof CalcomDatabaseError) {
          const voiceReply = getCalcomErrorVoiceResponse(error);
          return NextResponse.json({
            reply: voiceReply,
            conversationId,
            state: session.state,
            calcomError: error.errorInfo,
          });
        }
        // Non-DB errors: continue without availability — graceful degradation
      }
    }

    // Build system prompt with state-aware instructions
    const basePrompt = buildSystemPrompt(calcomAvailability);
    const statePrompt = buildStatePrompt(session);
    const systemPrompt = `${basePrompt}\n\n${statePrompt}`;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: systemPrompt,
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

    // Parse state markers from LLM response
    const parsed = parseStateMarkers(rawReply);
    let reply = parsed.cleanReply;

    // Update session with parsed data
    if (parsed.selectedSlot) {
      updateSession(conversationId, { selectedSlot: parsed.selectedSlot });
      // Re-fetch session after update
      session = getSession(conversationId)!;
    }

    if (parsed.patientInfo) {
      updateSession(conversationId, {
        patientInfo: { ...session.patientInfo, ...parsed.patientInfo },
      });
      session = getSession(conversationId)!;
    }

    // IMP-28: Validate patient data during INFO_COLLECTION -> CONFIRMATION transition
    if (
      session.state === ConversationState.INFO_COLLECTION &&
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

        // Update session with retries, staying in INFO_COLLECTION
        updateSession(conversationId, {
          validationRetries: newRetries,
        });

        // Build validation error context
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

        reply = `${parsed.cleanReply}\n\n${correctionHint}`;

        return NextResponse.json({
          reply,
          conversationId,
          state: session.state,
          validationErrors: validationResult.errors,
        });
      }
    }

    // Apply state transition if valid
    if (parsed.nextState) {
      const updated = updateSession(conversationId, {
        state: parsed.nextState,
      });
      if (updated) {
        session = updated;
      }
    }

    // When state reaches BOOKING, trigger server-side Cal.com booking
    if (session.state === ConversationState.BOOKING) {
      const bookingResult = await performBooking(session);
      if (bookingResult.success) {
        reply = bookingResult.confirmationMessage ?? reply;
      } else {
        reply = bookingResult.errorMessage ?? reply;
      }
    }

    // Store messages in session
    const lastUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");
    if (lastUserMessage) {
      updateSession(conversationId, {
        messages: [
          ...session.messages,
          { role: "user", content: lastUserMessage.content },
          { role: "assistant", content: reply },
        ],
      });
    }

    return NextResponse.json({
      reply,
      conversationId,
      state: session.state,
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

/**
 * Performs the actual Cal.com booking via direct PostgreSQL insert
 * when conversation reaches BOOKING state.
 */
async function performBooking(session: {
  selectedSlot?: string;
  patientInfo: { name?: string; email?: string; phone?: string };
}): Promise<{
  success: boolean;
  confirmationMessage?: string;
  errorMessage?: string;
}> {
  const logger = getSecureLogger();

  const { patientInfo, selectedSlot } = session;

  if (!patientInfo.name || !patientInfo.email || !selectedSlot) {
    logger.error("Booking attempted with incomplete data", {
      hasName: !!patientInfo.name,
      hasEmail: !!patientInfo.email,
      hasSlot: !!selectedSlot,
    });
    return {
      success: false,
      errorMessage:
        "Il manque des informations pour finaliser votre rendez-vous. Veuillez reessayer.",
    };
  }

  // Resolve slot details for confirmation message
  const slotDetails = resolveSlotDetails(selectedSlot);

  const eventTypeIdStr = process.env.CAL_COM_EVENT_TYPE_ID;
  if (!eventTypeIdStr) {
    // No event type configured — use fictitious confirmation only
    if (slotDetails) {
      return {
        success: true,
        confirmationMessage: formatAppointmentConfirmation(slotDetails),
      };
    }
    return {
      success: true,
      confirmationMessage: "Votre rendez-vous a bien ete enregistre. Nous vous souhaitons une bonne journee.",
    };
  }

  // Insert into Cal.com PostgreSQL
  try {
    const service = new CalcomService();
    const eventTypeId = parseInt(eventTypeIdStr, 10);

    // Fetch event type for duration
    const eventTypes = await service.getEventTypes();
    const eventType = eventTypes.find((et) => et.id === eventTypeId);
    if (!eventType) {
      throw new Error(`EventType id=${eventTypeId} not found`);
    }

    // Build startTime from slot details
    let startTime: Date;
    if (slotDetails) {
      startTime = new Date(`${slotDetails.date}T${slotDetails.time}:00`);
    } else {
      const dateMatch = selectedSlot.match(/(\d{4}-\d{2}-\d{2})/);
      const timeMatch = selectedSlot.match(/(\d{2}:\d{2})/);
      if (dateMatch && timeMatch) {
        startTime = new Date(`${dateMatch[1]}T${timeMatch[1]}:00`);
      } else {
        throw new Error(`Cannot parse slot: ${selectedSlot}`);
      }
    }

    const endTime = new Date(startTime.getTime() + eventType.length * 60_000);
    const uid = crypto.randomUUID();

    const booking = await service.createBooking({
      uid,
      title: `${eventType.title} - ${patientInfo.name.trim()}`,
      startTime,
      endTime,
      eventTypeId,
    });

    await service.createAttendee({
      bookingId: booking.id,
      name: patientInfo.name.trim(),
      email: patientInfo.email.trim(),
      phone: patientInfo.phone?.trim(),
      timeZone: "Europe/Paris",
      locale: "fr",
    });

    if (slotDetails) {
      return {
        success: true,
        confirmationMessage: formatAppointmentConfirmation(slotDetails),
      };
    }

    return {
      success: true,
      confirmationMessage:
        "Votre rendez-vous a bien ete enregistre. Nous vous souhaitons une bonne journee.",
    };
  } catch (error) {
    logger.error("Cal.com PostgreSQL booking failed:", error);
    return {
      success: false,
      errorMessage:
        "Une erreur est survenue lors de la creation de votre rendez-vous. Veuillez reessayer ou contacter le cabinet directement.",
    };
  }
}
