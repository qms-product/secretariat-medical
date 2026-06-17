/**
 * Cal.com PostgreSQL service (IMP-20 / ADR-6).
 *
 * Provides direct PostgreSQL access to Cal.com tables:
 * - SELECT: EventType, Availability, Booking, Schedule
 * - INSERT: Booking, Attendee
 *
 * Credentials are read from CALCOM_DATABASE_URL environment variable.
 */

import { Pool } from "pg";
import { withPgErrorHandling } from "./calcom-db-errors";
import { getPool } from "./calcom-availability";

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** Cal.com EventType row. */
export interface CalcomEventType {
  id: number;
  title: string;
  slug: string;
  length: number;
  description: string | null;
}

/** Cal.com Availability row. */
export interface CalcomAvailability {
  id: number;
  scheduleId: number;
  days: number[];
  startTime: string;
  endTime: string;
}

/** Cal.com Booking row. */
export interface CalcomBooking {
  id: number;
  uid: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: string;
  eventTypeId: number;
  description: string | null;
}

/** Cal.com Schedule row. */
export interface CalcomSchedule {
  id: number;
  userId: number;
  name: string;
  timeZone: string | null;
}

/** Data required to create a new Booking. */
export interface CreateBookingInput {
  uid: string;
  title: string;
  startTime: Date;
  endTime: Date;
  eventTypeId: number;
  description?: string;
}

/** Data required to create a new Attendee. */
export interface CreateAttendeeInput {
  bookingId: number;
  name: string;
  email: string;
  phone?: string;
  timeZone?: string;
  locale?: string;
}

/** Cal.com Attendee row. */
export interface CalcomAttendee {
  id: number;
  bookingId: number;
  name: string;
  email: string;
  phone: string | null;
  timeZone: string;
  locale: string;
}

// ─── Service class ───────────────────────────────────────────────────────────

/**
 * Service for direct PostgreSQL access to Cal.com database tables.
 *
 * Uses the shared pool from calcom-availability for connection management.
 * All operations are wrapped with PostgreSQL error handling (ADR-12).
 */
export class CalcomService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool ?? getPool();
  }

  // ─── EventType (SELECT) ─────────────────────────────────────────────

  /**
   * Returns active event types.
   * Fulfils REQ-102: read EventType table via SQL.
   */
  async getEventTypes(): Promise<CalcomEventType[]> {
    return withPgErrorHandling(async () => {
      const result = await this.pool.query(
        `SELECT id, title, slug, length, description
         FROM "EventType"
         WHERE hidden = false
         ORDER BY id ASC`
      );
      return result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        length: row.length,
        description: row.description,
      }));
    });
  }

  // ─── Availability (SELECT) ──────────────────────────────────────────

  /**
   * Returns availability entries, optionally filtered by schedule.
   * Fulfils REQ-103: read Availability table via SQL.
   */
  async getAvailabilities(scheduleId?: number): Promise<CalcomAvailability[]> {
    return withPgErrorHandling(async () => {
      let query = `SELECT id, "scheduleId", days, "startTime", "endTime"
                    FROM "Availability"`;
      const params: unknown[] = [];

      if (scheduleId !== undefined) {
        query += ` WHERE "scheduleId" = $1`;
        params.push(scheduleId);
      }

      query += ` ORDER BY id ASC`;

      const result = await this.pool.query(query, params);
      return result.rows.map((row) => ({
        id: row.id,
        scheduleId: row.scheduleId,
        days: row.days,
        startTime: row.startTime,
        endTime: row.endTime,
      }));
    });
  }

  // ─── Booking (SELECT) ──────────────────────────────────────────────

  /**
   * Returns bookings, optionally filtered by event type and date range.
   * Fulfils REQ-104: read Booking table via SQL.
   */
  async getBookings(options?: {
    eventTypeId?: number;
    startAfter?: Date;
    startBefore?: Date;
  }): Promise<CalcomBooking[]> {
    return withPgErrorHandling(async () => {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (options?.eventTypeId !== undefined) {
        conditions.push(`"eventTypeId" = $${paramIndex++}`);
        params.push(options.eventTypeId);
      }
      if (options?.startAfter) {
        conditions.push(`"startTime" >= $${paramIndex++}`);
        params.push(options.startAfter.toISOString());
      }
      if (options?.startBefore) {
        conditions.push(`"startTime" < $${paramIndex++}`);
        params.push(options.startBefore.toISOString());
      }

      let query = `SELECT id, uid, title, "startTime", "endTime", status, "eventTypeId", description
                    FROM "Booking"`;
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }
      query += ` ORDER BY "startTime" ASC`;

      const result = await this.pool.query(query, params);
      return result.rows.map((row) => ({
        id: row.id,
        uid: row.uid,
        title: row.title,
        startTime: new Date(row.startTime),
        endTime: new Date(row.endTime),
        status: row.status,
        eventTypeId: row.eventTypeId,
        description: row.description,
      }));
    });
  }

  // ─── Schedule (SELECT) ─────────────────────────────────────────────

  /**
   * Returns schedules, optionally filtered by user.
   * Fulfils REQ-105: read Schedule table via SQL.
   */
  async getSchedules(userId?: number): Promise<CalcomSchedule[]> {
    return withPgErrorHandling(async () => {
      let query = `SELECT id, "userId", name, "timeZone"
                    FROM "Schedule"`;
      const params: unknown[] = [];

      if (userId !== undefined) {
        query += ` WHERE "userId" = $1`;
        params.push(userId);
      }

      query += ` ORDER BY id ASC`;

      const result = await this.pool.query(query, params);
      return result.rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        name: row.name,
        timeZone: row.timeZone,
      }));
    });
  }

  // ─── Booking (INSERT) ──────────────────────────────────────────────

  /**
   * Creates a new booking record.
   * Fulfils REQ-106: insert into Booking table via SQL.
   */
  async createBooking(input: CreateBookingInput): Promise<CalcomBooking> {
    return withPgErrorHandling(async () => {
      const result = await this.pool.query(
        `INSERT INTO "Booking" (uid, title, "startTime", "endTime", "eventTypeId", description, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACCEPTED')
         RETURNING id, uid, title, "startTime", "endTime", status, "eventTypeId", description`,
        [
          input.uid,
          input.title,
          input.startTime.toISOString(),
          input.endTime.toISOString(),
          input.eventTypeId,
          input.description ?? null,
        ]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        uid: row.uid,
        title: row.title,
        startTime: new Date(row.startTime),
        endTime: new Date(row.endTime),
        status: row.status,
        eventTypeId: row.eventTypeId,
        description: row.description,
      };
    });
  }

  // ─── Attendee (INSERT) ─────────────────────────────────────────────

  /**
   * Creates a new attendee associated with a booking.
   * Fulfils REQ-107: insert into Attendee table via SQL.
   */
  async createAttendee(input: CreateAttendeeInput): Promise<CalcomAttendee> {
    return withPgErrorHandling(async () => {
      const timeZone = input.timeZone ?? "Europe/Paris";
      const locale = input.locale ?? "fr";

      const result = await this.pool.query(
        `INSERT INTO "Attendee" ("bookingId", name, email, phone, "timeZone", locale)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, "bookingId", name, email, phone, "timeZone", locale`,
        [
          input.bookingId,
          input.name,
          input.email,
          input.phone ?? null,
          timeZone,
          locale,
        ]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        bookingId: row.bookingId,
        name: row.name,
        email: row.email,
        phone: row.phone,
        timeZone: row.timeZone,
        locale: row.locale,
      };
    });
  }
}
