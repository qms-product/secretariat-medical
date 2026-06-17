import { describe, it, expect } from "vitest";
import {
  PgErrorType,
  PG_ERRORS,
  PG_CONNECTION_TIMEOUT_MS,
  CalcomDatabaseError,
  classifyPgError,
  withPgErrorHandling,
} from "../calcom-db-errors";

describe("calcom-db-errors (IMP-31 / ADR-12)", () => {
  describe("PG_CONNECTION_TIMEOUT_MS", () => {
    it("should be 10 seconds", () => {
      expect(PG_CONNECTION_TIMEOUT_MS).toBe(10_000);
    });
  });

  describe("PG_ERRORS", () => {
    it("should define error info for all PgErrorType values", () => {
      expect(PG_ERRORS[PgErrorType.TIMEOUT]).toBeDefined();
      expect(PG_ERRORS[PgErrorType.CONNECTION_REFUSED]).toBeDefined();
      expect(PG_ERRORS[PgErrorType.UNKNOWN]).toBeDefined();
    });

    it("should have French user-facing messages", () => {
      expect(PG_ERRORS[PgErrorType.TIMEOUT].message).toContain("rendez-vous");
      expect(PG_ERRORS[PgErrorType.CONNECTION_REFUSED].message).toContain(
        "indisponible"
      );
      expect(PG_ERRORS[PgErrorType.UNKNOWN].message).toContain("erreur");
    });

    it("should have suggestions for each error type", () => {
      for (const errorType of Object.values(PgErrorType)) {
        expect(PG_ERRORS[errorType].suggestions.length).toBeGreaterThan(0);
      }
    });

    it("should have distinct error codes", () => {
      const codes = Object.values(PG_ERRORS).map((e) => e.code);
      expect(new Set(codes).size).toBe(codes.length);
    });
  });

  describe("classifyPgError", () => {
    it("should classify ETIMEDOUT as TIMEOUT", () => {
      const err = new Error("connect ETIMEDOUT");
      (err as NodeJS.ErrnoException).code = "ETIMEDOUT";
      expect(classifyPgError(err)).toBe(PgErrorType.TIMEOUT);
    });

    it("should classify ECONNABORTED as TIMEOUT", () => {
      const err = new Error("connection aborted");
      (err as NodeJS.ErrnoException).code = "ECONNABORTED";
      expect(classifyPgError(err)).toBe(PgErrorType.TIMEOUT);
    });

    it('should classify errors with "timeout" in message as TIMEOUT', () => {
      expect(classifyPgError(new Error("Connection timeout after 10s"))).toBe(
        PgErrorType.TIMEOUT
      );
    });

    it('should classify errors with "timed out" in message as TIMEOUT', () => {
      expect(classifyPgError(new Error("Operation timed out"))).toBe(
        PgErrorType.TIMEOUT
      );
    });

    it("should classify ECONNREFUSED as CONNECTION_REFUSED", () => {
      const err = new Error("connect ECONNREFUSED 127.0.0.1:5432");
      (err as NodeJS.ErrnoException).code = "ECONNREFUSED";
      expect(classifyPgError(err)).toBe(PgErrorType.CONNECTION_REFUSED);
    });

    it('should classify errors with "connection refused" in message as CONNECTION_REFUSED', () => {
      expect(
        classifyPgError(new Error("connection refused to host"))
      ).toBe(PgErrorType.CONNECTION_REFUSED);
    });

    it("should classify unknown errors as UNKNOWN", () => {
      expect(classifyPgError(new Error("syntax error"))).toBe(
        PgErrorType.UNKNOWN
      );
    });

    it("should classify non-Error values as UNKNOWN", () => {
      expect(classifyPgError("string error")).toBe(PgErrorType.UNKNOWN);
      expect(classifyPgError(null)).toBe(PgErrorType.UNKNOWN);
      expect(classifyPgError(undefined)).toBe(PgErrorType.UNKNOWN);
      expect(classifyPgError(42)).toBe(PgErrorType.UNKNOWN);
    });
  });

  describe("CalcomDatabaseError", () => {
    it("should store errorInfo", () => {
      const err = new CalcomDatabaseError(PG_ERRORS[PgErrorType.TIMEOUT]);
      expect(err.errorInfo).toBe(PG_ERRORS[PgErrorType.TIMEOUT]);
      expect(err.name).toBe("CalcomDatabaseError");
      expect(err.message).toBe(PG_ERRORS[PgErrorType.TIMEOUT].message);
    });

    it("should preserve the cause", () => {
      const cause = new Error("original");
      const err = new CalcomDatabaseError(
        PG_ERRORS[PgErrorType.CONNECTION_REFUSED],
        cause
      );
      expect(err.cause).toBe(cause);
    });

    it("should be an instance of Error", () => {
      const err = new CalcomDatabaseError(PG_ERRORS[PgErrorType.UNKNOWN]);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("withPgErrorHandling", () => {
    it("should return the result on success", async () => {
      const result = await withPgErrorHandling(async () => "ok");
      expect(result).toBe("ok");
    });

    it("should wrap ETIMEDOUT errors as CalcomDatabaseError with TIMEOUT type", async () => {
      const pgErr = new Error("connect ETIMEDOUT");
      (pgErr as NodeJS.ErrnoException).code = "ETIMEDOUT";

      await expect(
        withPgErrorHandling(async () => {
          throw pgErr;
        })
      ).rejects.toSatisfy((err: CalcomDatabaseError) => {
        expect(err).toBeInstanceOf(CalcomDatabaseError);
        expect(err.errorInfo.type).toBe(PgErrorType.TIMEOUT);
        expect(err.cause).toBe(pgErr);
        return true;
      });
    });

    it("should wrap ECONNREFUSED errors as CalcomDatabaseError with CONNECTION_REFUSED type", async () => {
      const pgErr = new Error("connect ECONNREFUSED 127.0.0.1:5432");
      (pgErr as NodeJS.ErrnoException).code = "ECONNREFUSED";

      await expect(
        withPgErrorHandling(async () => {
          throw pgErr;
        })
      ).rejects.toSatisfy((err: CalcomDatabaseError) => {
        expect(err).toBeInstanceOf(CalcomDatabaseError);
        expect(err.errorInfo.type).toBe(PgErrorType.CONNECTION_REFUSED);
        expect(err.cause).toBe(pgErr);
        return true;
      });
    });

    it("should wrap unknown errors as CalcomDatabaseError with UNKNOWN type", async () => {
      const pgErr = new Error("some other error");

      await expect(
        withPgErrorHandling(async () => {
          throw pgErr;
        })
      ).rejects.toSatisfy((err: CalcomDatabaseError) => {
        expect(err).toBeInstanceOf(CalcomDatabaseError);
        expect(err.errorInfo.type).toBe(PgErrorType.UNKNOWN);
        return true;
      });
    });

    it("should re-throw CalcomDatabaseError without wrapping", async () => {
      const original = new CalcomDatabaseError(
        PG_ERRORS[PgErrorType.TIMEOUT]
      );

      await expect(
        withPgErrorHandling(async () => {
          throw original;
        })
      ).rejects.toBe(original);
    });

    it("should not crash the application on connection errors", async () => {
      const errors = [
        (() => {
          const e = new Error("ETIMEDOUT");
          (e as NodeJS.ErrnoException).code = "ETIMEDOUT";
          return e;
        })(),
        (() => {
          const e = new Error("ECONNREFUSED");
          (e as NodeJS.ErrnoException).code = "ECONNREFUSED";
          return e;
        })(),
        new Error("unknown db error"),
        "string error",
        null,
      ];

      for (const err of errors) {
        try {
          await withPgErrorHandling(async () => {
            throw err;
          });
        } catch (caught) {
          expect(caught).toBeInstanceOf(CalcomDatabaseError);
        }
      }
    });
  });
});
