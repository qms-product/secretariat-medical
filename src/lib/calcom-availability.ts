/**
 * Cal.com availability service via PostgreSQL (IMP-35 / REQ-90).
 *
 * Fetches real availability data from the Cal.com PostgreSQL database
 * and formats it for injection into the LLM system prompt.
 */

import { Pool } from "pg";
import { withPgErrorHandling } from "./calcom-db-errors";

/** Represents a single available time slot from Cal.com. */
export interface CalcomAvailableSlot {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
}

/** Result of fetching Cal.com availability. */
export interface CalcomAvailabilityResult {
  slots: CalcomAvailableSlot[];
  fetchedAt: string;
}

/** Default number of days to look ahead for availability. */
export const AVAILABILITY_LOOKAHEAD_DAYS = 14;

/**
 * Creates a PostgreSQL connection pool for the Cal.com database.
 * Uses CALCOM_DATABASE_URL environment variable.
 */
export function createPool(): Pool {
  const connectionString = process.env.CALCOM_DATABASE_URL;
  if (!connectionString) {
    throw new Error("CALCOM_DATABASE_URL not configured");
  }

  return new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
}

/** Shared pool instance (lazy-initialized). */
let sharedPool: Pool | null = null;

/** Returns the shared pool, creating it if needed. */
export function getPool(): Pool {
  if (!sharedPool) {
    sharedPool = createPool();
  }
  return sharedPool;
}

/** Resets the shared pool (for testing). */
export function resetPool(): void {
  sharedPool = null;
}

/**
 * Fetches available time slots from Cal.com's PostgreSQL database.
 *
 * Queries the bookings table to find open slots for the configured
 * event type within the lookahead period.
 *
 * @param pool - PostgreSQL connection pool (defaults to shared pool)
 * @param lookaheadDays - Number of days to look ahead (defaults to 14)
 * @returns Available slots and fetch timestamp
 */
export async function fetchAvailability(
  pool?: Pool,
  lookaheadDays: number = AVAILABILITY_LOOKAHEAD_DAYS
): Promise<CalcomAvailabilityResult> {
  const pgPool = pool ?? getPool();
  const eventTypeId = process.env.CAL_COM_EVENT_TYPE_ID;

  if (!eventTypeId) {
    throw new Error("CAL_COM_EVENT_TYPE_ID not configured");
  }

  return withPgErrorHandling(async () => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + lookaheadDays);

    const query = `
      SELECT
        b."startTime" AS start_time,
        b."endTime" AS end_time,
        b.title
      FROM "Booking" b
      WHERE b."eventTypeId" = $1
        AND b."startTime" >= $2
        AND b."startTime" < $3
        AND b.status = 'ACCEPTED'
      ORDER BY b."startTime" ASC
    `;

    const result = await pgPool.query(query, [
      parseInt(eventTypeId, 10),
      now.toISOString(),
      endDate.toISOString(),
    ]);

    const slots: CalcomAvailableSlot[] = result.rows.map((row) => {
      const startDate = new Date(row.start_time);
      return {
        date: startDate.toISOString().split("T")[0],
        startTime: startDate.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        endTime: new Date(row.end_time).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        title: row.title,
      };
    });

    return {
      slots,
      fetchedAt: now.toISOString(),
    };
  });
}

/**
 * Formats Cal.com availability data as text for the LLM system prompt.
 *
 * @param availability - The availability result to format
 * @returns Formatted text block suitable for prompt injection
 */
export function formatAvailabilityForPrompt(
  availability: CalcomAvailabilityResult
): string {
  if (availability.slots.length === 0) {
    return `DISPONIBILITES CAL.COM (mis a jour le ${formatDate(availability.fetchedAt)}) :
Aucun creneau reserve pour les ${AVAILABILITY_LOOKAHEAD_DAYS} prochains jours.`;
  }

  const slotsByDate = new Map<string, CalcomAvailableSlot[]>();
  for (const slot of availability.slots) {
    const existing = slotsByDate.get(slot.date) ?? [];
    existing.push(slot);
    slotsByDate.set(slot.date, existing);
  }

  const lines: string[] = [
    `DISPONIBILITES CAL.COM (mis a jour le ${formatDate(availability.fetchedAt)}) :`,
    `Creneaux reserves pour les ${AVAILABILITY_LOOKAHEAD_DAYS} prochains jours :`,
  ];

  for (const [date, slots] of slotsByDate) {
    lines.push(`\n${formatDateLabel(date)} :`);
    for (const slot of slots) {
      lines.push(`- ${slot.startTime} - ${slot.endTime} : ${slot.title}`);
    }
  }

  return lines.join("\n");
}

/** Formats an ISO date string for display. */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formats a YYYY-MM-DD date as a French label. */
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
