/**
 * Conversation State Manager (ADR-7, IMP-23, IMP-36)
 *
 * LLM context-based state management with structured system prompts.
 * States: GREETING → SLOT_PROPOSAL → INFO_COLLECTION → CONFIRMATION → BOOKING
 *         GREETING/SLOT_PROPOSAL → NO_SLOTS_AVAILABLE (terminal, IMP-36)
 * State is maintained in-memory per session.
 */

import { OFFICE_INFO } from "./data";
import { validatePatientData, type ValidationError } from "./patient-validation";

export enum ConversationState {
  GREETING = "GREETING",
  SLOT_PROPOSAL = "SLOT_PROPOSAL",
  NO_SLOTS_AVAILABLE = "NO_SLOTS_AVAILABLE",
  INFO_COLLECTION = "INFO_COLLECTION",
  CONFIRMATION = "CONFIRMATION",
  BOOKING = "BOOKING",
}

/** Valid state transitions */
const STATE_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  [ConversationState.GREETING]: [
    ConversationState.SLOT_PROPOSAL,
    ConversationState.NO_SLOTS_AVAILABLE,
  ],
  [ConversationState.SLOT_PROPOSAL]: [
    ConversationState.SLOT_PROPOSAL,
    ConversationState.INFO_COLLECTION,
    ConversationState.NO_SLOTS_AVAILABLE,
  ],
  [ConversationState.NO_SLOTS_AVAILABLE]: [],
  [ConversationState.INFO_COLLECTION]: [
    ConversationState.INFO_COLLECTION,
    ConversationState.CONFIRMATION,
  ],
  [ConversationState.CONFIRMATION]: [
    ConversationState.BOOKING,
    ConversationState.SLOT_PROPOSAL,
  ],
  [ConversationState.BOOKING]: [],
};

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PatientInfo {
  name?: string;
  email?: string;
  phone?: string;
}

/** Maximum validation retry attempts before suggesting alternative contact (IMP-28) */
export const MAX_VALIDATION_RETRIES = 3;

/** Tracks validation retry attempts per field (IMP-28 / ADR-9) */
export interface ValidationRetryState {
  email: number;
  phone: number;
}

export interface ConversationSession {
  id: string;
  state: ConversationState;
  messages: ConversationMessage[];
  patientInfo: PatientInfo;
  selectedSlot?: string;
  validationRetries: ValidationRetryState;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationResponse {
  conversationId: string;
  state: ConversationState;
  reply: string;
  patientInfo: PatientInfo;
  selectedSlot?: string;
}

/** In-memory session store */
const sessions = new Map<string, ConversationSession>();

/** Session TTL: 30 minutes */
const SESSION_TTL_MS = 30 * 60 * 1000;

function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Remove expired sessions */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

export function isValidTransition(
  from: ConversationState,
  to: ConversationState
): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidState(state: string): state is ConversationState {
  return Object.values(ConversationState).includes(state as ConversationState);
}

export function createSession(): ConversationSession {
  cleanupExpiredSessions();

  const now = Date.now();
  const session: ConversationSession = {
    id: generateId(),
    state: ConversationState.GREETING,
    messages: [],
    patientInfo: {},
    validationRetries: { email: 0, phone: 0 },
    createdAt: now,
    updatedAt: now,
  };

  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): ConversationSession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;

  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessions.delete(id);
    return undefined;
  }

  return session;
}

export function updateSession(
  id: string,
  updates: Partial<Pick<ConversationSession, "state" | "messages" | "patientInfo" | "selectedSlot" | "validationRetries">>
): ConversationSession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;

  if (updates.state !== undefined && updates.state !== session.state) {
    if (!isValidTransition(session.state, updates.state)) {
      return undefined;
    }
  }

  Object.assign(session, updates, { updatedAt: Date.now() });
  return session;
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id);
}

/**
 * Build validation context for the INFO_COLLECTION state prompt (IMP-28 / ADR-9).
 * Validates currently collected patient data and generates contextual instructions
 * for the LLM to produce natural correction prompts.
 */
function buildInfoCollectionPrompt(session: ConversationSession): string {
  const { patientInfo, validationRetries } = session;
  const validationResult = validatePatientData({
    email: patientInfo.email,
    phone: patientInfo.phone,
  });

  let validationContext = "";
  if (!validationResult.valid) {
    const errorLines = validationResult.errors.map((e: ValidationError) => {
      const field = e.field as keyof ValidationRetryState;
      const retries = validationRetries[field] ?? 0;
      const maxReached = retries >= MAX_VALIDATION_RETRIES;
      return `- ${e.field}: ${e.message} (tentative ${retries + 1}/${MAX_VALIDATION_RETRIES}${maxReached ? " — LIMITE ATTEINTE, propose une alternative" : ""})`;
    });
    validationContext = `
ERREURS DE VALIDATION DETECTEES :
${errorLines.join("\n")}
Tu dois demander la correction de ces informations de maniere naturelle et bienveillante.
`;
  }

  return `
ETAT ACTUEL: INFO_COLLECTION
Creneau: ${session.selectedSlot ?? "non defini"}
Deja collecte: ${JSON.stringify(session.patientInfo)}
${validationContext}
Collecte nom, email et telephone. Demande UNE info a la fois en une phrase courte. Exemple : "Et votre email ?"
Si tout est collecte et valide :
{"next_state": "CONFIRMATION", "patient_info": {"name": "...", "email": "...", "phone": "..."}}
Sinon, reste dans cet etat :
{"next_state": "INFO_COLLECTION", "patient_info": {"name": "...", "email": "...", "phone": "..."}}
`;
}

/**
 * Build a state-aware system prompt supplement for the current conversation state.
 * This is appended to the base system prompt to guide LLM behavior per state.
 */
export function buildStatePrompt(session: ConversationSession): string {
  const stateInstructions: Record<ConversationState, string> = {
    [ConversationState.GREETING]: `
ETAT ACTUEL: GREETING
Accueille le patient en une phrase courte. Exemple : "Bonjour, cabinet Saint-Martin, je vous ecoute."
Ajoute le marqueur sur une ligne separee :
{"next_state": "SLOT_PROPOSAL"}
`,
    [ConversationState.SLOT_PROPOSAL]: `
ETAT ACTUEL: SLOT_PROPOSAL
Propose un creneau disponible en une phrase. Si le patient accepte :
{"next_state": "INFO_COLLECTION", "selected_slot": "<creneau choisi>"}
Si le patient refuse, propose le suivant :
{"next_state": "SLOT_PROPOSAL"}
Si plus aucun creneau :
{"next_state": "NO_SLOTS_AVAILABLE"}
`,
    [ConversationState.NO_SLOTS_AVAILABLE]: `
ETAT ACTUEL: NO_SLOTS_AVAILABLE
Dis en une phrase qu'il n'y a plus de creneaux et oriente vers le ${OFFICE_INFO.phone}. Pas de marqueur JSON.
`,
    [ConversationState.INFO_COLLECTION]: buildInfoCollectionPrompt(session),
    [ConversationState.CONFIRMATION]: `
ETAT ACTUEL: CONFIRMATION
Creneau: ${session.selectedSlot ?? "non defini"}
Patient: ${JSON.stringify(session.patientInfo)}
Recapitule en texte brut (pas de listes) : date, heure, nom, email, telephone. Demande confirmation en une phrase.
Si oui : {"next_state": "BOOKING"}
Si non : {"next_state": "SLOT_PROPOSAL"}
`,
    [ConversationState.BOOKING]: `
ETAT ACTUEL: BOOKING
Le systeme cree le rendez-vous. Confirme simplement en une phrase avec la date et le medecin, puis souhaite bonne journee.
`,
  };

  const jsonRule = `MARQUEURS JSON : ecris-les sur une ligne separee, en texte brut. JAMAIS dans un bloc markdown, jamais entre \`\`\`.`;
  const instruction = stateInstructions[session.state] ?? "";
  return instruction ? `${jsonRule}\n${instruction}` : "";
}

/**
 * Parse state transition markers from the LLM response.
 * Returns extracted data and the cleaned reply (without JSON markers).
 */
export function parseStateMarkers(reply: string): {
  cleanReply: string;
  nextState?: ConversationState;
  patientInfo?: PatientInfo;
  selectedSlot?: string;
} {
  const result: {
    cleanReply: string;
    nextState?: ConversationState;
    patientInfo?: PatientInfo;
    selectedSlot?: string;
  } = { cleanReply: reply };

  // Pattern that matches JSON objects containing "next_state", allowing one level of nested braces
  // (needed for patient_info: {"name": "...", "email": "...", "phone": "..."})
  const NESTED_JSON = /\{(?:[^{}]|\{[^{}]*\})*"next_state"(?:[^{}]|\{[^{}]*\})*\}/g;

  // Pre-process: unwrap backtick/code-block wrapped markers so regexes can find them
  const normalized = reply
    .replace(new RegExp("```json?\\s*\\n?\\s*(" + NESTED_JSON.source + ")\\s*\\n?\\s*```", "g"), "$1")
    .replace(new RegExp("`(" + NESTED_JSON.source + ")`", "g"), "$1");

  // Extract all JSON marker objects from the normalized text
  let jsonMatch: RegExpExecArray | null;
  const extractRegex = new RegExp(NESTED_JSON.source, "g");
  while ((jsonMatch = extractRegex.exec(normalized)) !== null) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.next_state && isValidState(parsed.next_state)) {
        result.nextState = parsed.next_state;
      }
      if (parsed.selected_slot) {
        result.selectedSlot = parsed.selected_slot;
      }
      if (parsed.patient_info) {
        result.patientInfo = parsed.patient_info;
      }
    } catch {
      // Ignore parse failures
    }
  }

  // Remove all JSON markers from the reply, including markdown code blocks and backtick wrapping
  const NESTED_JSON_SRC = NESTED_JSON.source;
  result.cleanReply = reply
    // Triple-backtick blocks containing markers
    .replace(new RegExp("\\n?\\s*```json?\\s*\\n?\\s*" + NESTED_JSON_SRC + "\\s*\\n?\\s*```\\s*\\n?", "g"), "\n")
    // Empty triple-backtick blocks
    .replace(/\n?\s*```json?\s*\n?\s*```\s*\n?/g, "\n")
    // Single backtick-wrapped markers
    .replace(new RegExp("\\n?\\s*`" + NESTED_JSON_SRC + "`\\s*\\n?", "g"), "\n")
    // Plain JSON markers (with possible nested braces)
    .replace(new RegExp("\\n?\\s*" + NESTED_JSON_SRC + "\\s*\\n?", "g"), "\n")
    .trim();

  return result;
}

/**
 * Pre-built vocal message for when no slots are available (IMP-36 / REQ-93).
 * Used as a fallback when the LLM response cannot be obtained or as a direct response.
 */
export const NO_SLOTS_MESSAGE = `Nous sommes desoles, il n'y a malheureusement plus de creneaux disponibles pour le moment. Nous vous invitons a contacter directement le cabinet au ${OFFICE_INFO.phone}, du lundi au vendredi de 8 heures a 18 heures, pour verifier de nouvelles disponibilites. Nous vous souhaitons une bonne journee.`;

/**
 * Checks if the conversation is in a terminal state (IMP-36).
 */
export function isTerminalState(state: ConversationState): boolean {
  return STATE_TRANSITIONS[state].length === 0;
}

/** Expose for testing */
export function _getSessionsMap(): Map<string, ConversationSession> {
  return sessions;
}

export function _clearSessions(): void {
  sessions.clear();
}
