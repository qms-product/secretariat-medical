/**
 * PostgreSQL error handling for Cal.com database connectivity (ADR-12 / IMP-31).
 *
 * Detects and categorises PostgreSQL connection errors (timeout, connection refused)
 * and returns structured error objects for the voice response system.
 */

/** Timeout for PostgreSQL connection attempts in milliseconds. */
export const PG_CONNECTION_TIMEOUT_MS = 10_000;

/** PostgreSQL error types relevant to connection issues. */
export enum PgErrorType {
  TIMEOUT = "PG_TIMEOUT",
  CONNECTION_REFUSED = "PG_CONNECTION_REFUSED",
  UNKNOWN = "PG_UNKNOWN",
}

/** Structured PostgreSQL error information for the voice flow. */
export interface PgErrorInfo {
  /** Categorised error type */
  type: PgErrorType;
  /** Machine-readable error code */
  code: string;
  /** User-facing message in French */
  message: string;
  /** Actionable suggestions in French */
  suggestions: string[];
}

/** Pre-defined error info objects for each PostgreSQL error type. */
export const PG_ERRORS: Record<PgErrorType, PgErrorInfo> = {
  [PgErrorType.TIMEOUT]: {
    type: PgErrorType.TIMEOUT,
    code: "CALCOM_DB_TIMEOUT",
    message:
      "Le service de prise de rendez-vous ne repond pas actuellement. Veuillez reessayer dans quelques instants.",
    suggestions: [
      "Reessayez dans quelques instants",
      "Si le probleme persiste, veuillez rappeler ulterieurement",
    ],
  },
  [PgErrorType.CONNECTION_REFUSED]: {
    type: PgErrorType.CONNECTION_REFUSED,
    code: "CALCOM_DB_CONNECTION_REFUSED",
    message:
      "Le service de prise de rendez-vous est temporairement indisponible. Veuillez rappeler ulterieurement.",
    suggestions: [
      "Le service est en cours de maintenance ou indisponible",
      "Veuillez rappeler dans quelques minutes",
    ],
  },
  [PgErrorType.UNKNOWN]: {
    type: PgErrorType.UNKNOWN,
    code: "CALCOM_DB_ERROR",
    message:
      "Une erreur est survenue avec le service de prise de rendez-vous. Veuillez reessayer.",
    suggestions: [
      "Reessayez dans quelques instants",
      "Si le probleme persiste, veuillez rappeler ulterieurement",
    ],
  },
};

/** Custom error class for PostgreSQL connection failures. */
export class CalcomDatabaseError extends Error {
  public readonly errorInfo: PgErrorInfo;

  constructor(errorInfo: PgErrorInfo, cause?: unknown) {
    super(errorInfo.message);
    this.name = "CalcomDatabaseError";
    this.errorInfo = errorInfo;
    this.cause = cause;
  }
}

/**
 * Classifies a caught error into a PgErrorType.
 *
 * Detects:
 * - ETIMEDOUT / ECONNABORTED / timeout keywords → TIMEOUT
 * - ECONNREFUSED → CONNECTION_REFUSED
 * - Everything else → UNKNOWN
 */
export function classifyPgError(error: unknown): PgErrorType {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const code = (error as NodeJS.ErrnoException).code?.toUpperCase() ?? "";

    // Timeout detection
    if (
      code === "ETIMEDOUT" ||
      code === "ECONNABORTED" ||
      msg.includes("timeout") ||
      msg.includes("timed out")
    ) {
      return PgErrorType.TIMEOUT;
    }

    // Connection refused detection
    if (code === "ECONNREFUSED" || msg.includes("connection refused")) {
      return PgErrorType.CONNECTION_REFUSED;
    }
  }

  return PgErrorType.UNKNOWN;
}

/**
 * Wraps a database operation with PostgreSQL-specific error handling.
 *
 * Catches errors, classifies them, and throws a CalcomDatabaseError
 * with structured error info suitable for the voice response system.
 *
 * @param operation - Async function performing the database operation
 * @returns The result of the operation if successful
 * @throws CalcomDatabaseError with categorised error info on failure
 */
export async function withPgErrorHandling<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CalcomDatabaseError) {
      throw error;
    }

    const errorType = classifyPgError(error);
    throw new CalcomDatabaseError(PG_ERRORS[errorType], error);
  }
}
