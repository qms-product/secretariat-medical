import { describe, it, expect } from "vitest";
import { CalcomApiError, CalcomTimeoutError } from "../calcom";
import {
  handleCalcomError,
  handleNoSlotsAvailable,
  getVocalMessage,
} from "../error-handler";
import type { VocalErrorResponse } from "../error-handler";

describe("ErrorHandlerService (IMP-26 / ADR-9)", () => {
  describe("handleCalcomError", () => {
    describe("timeout errors (REQ-68)", () => {
      it("should return a vocal apology message for CalcomTimeoutError", () => {
        const error = new CalcomTimeoutError();
        const result = handleCalcomError(error);

        expect(result.errorType).toBe("timeout");
        expect(result.vocalMessage).toContain("desole");
        expect(result.vocalMessage).toContain("reessayer");
      });

      it("should maintain a conversational tone for timeout", () => {
        const error = new CalcomTimeoutError();
        const result = handleCalcomError(error);

        // Must use polite form and be conversational
        expect(result.vocalMessage).toContain("s'il vous plait");
      });
    });

    describe("4xx client errors (REQ-70)", () => {
      it("should return a guidance message for 400 Bad Request", () => {
        const error = new CalcomApiError(400, "Bad Request");
        const result = handleCalcomError(error);

        expect(result.errorType).toBe("client_error");
        expect(result.vocalMessage).toContain("desole");
        expect(result.vocalMessage).toContain("verifier");
      });

      it("should return a guidance message for 404 Not Found", () => {
        const error = new CalcomApiError(404, "Not Found");
        const result = handleCalcomError(error);

        expect(result.errorType).toBe("client_error");
      });

      it("should return a guidance message for 422 Unprocessable Entity", () => {
        const error = new CalcomApiError(422, "Unprocessable Entity");
        const result = handleCalcomError(error);

        expect(result.errorType).toBe("client_error");
      });

      it("should return a guidance message for 429 Too Many Requests", () => {
        const error = new CalcomApiError(429, "Too Many Requests");
        const result = handleCalcomError(error);

        expect(result.errorType).toBe("client_error");
      });

      it("should maintain a conversational tone for 4xx errors", () => {
        const error = new CalcomApiError(400, "Bad Request");
        const result = handleCalcomError(error);

        expect(result.vocalMessage).toContain("s'il vous plait");
      });
    });

    describe("5xx server errors (REQ-72)", () => {
      it("should suggest calling back later for 500 Internal Server Error", () => {
        const error = new CalcomApiError(500, "Internal Server Error");
        const result = handleCalcomError(error);

        expect(result.errorType).toBe("server_error");
        expect(result.vocalMessage).toContain("desole");
        expect(result.vocalMessage).toContain("rappeler");
      });

      it("should suggest calling back later for 502 Bad Gateway", () => {
        const error = new CalcomApiError(502, "Bad Gateway");
        const result = handleCalcomError(error);

        expect(result.errorType).toBe("server_error");
        expect(result.vocalMessage).toContain("rappeler");
      });

      it("should suggest calling back later for 503 Service Unavailable", () => {
        const error = new CalcomApiError(503, "Service Unavailable");
        const result = handleCalcomError(error);

        expect(result.errorType).toBe("server_error");
      });

      it("should suggest calling back later for 504 Gateway Timeout", () => {
        const error = new CalcomApiError(504, "Gateway Timeout");
        const result = handleCalcomError(error);

        expect(result.errorType).toBe("server_error");
      });
    });

    describe("unknown errors", () => {
      it("should treat unknown Error instances as server errors", () => {
        const error = new Error("Something unexpected");
        const result = handleCalcomError(error);

        expect(result.errorType).toBe("server_error");
        expect(result.vocalMessage).toContain("rappeler");
      });

      it("should treat non-Error values as server errors", () => {
        const result = handleCalcomError("string error");

        expect(result.errorType).toBe("server_error");
      });
    });
  });

  describe("handleNoSlotsAvailable (REQ-52)", () => {
    it("should return an informative vocal message for no slots", () => {
      const result = handleNoSlotsAvailable();

      expect(result.errorType).toBe("no_slots");
      expect(result.vocalMessage).toContain("aucun creneau");
    });

    it("should suggest calling back later", () => {
      const result = handleNoSlotsAvailable();

      expect(result.vocalMessage).toContain("rappeler");
    });

    it("should maintain a conversational tone", () => {
      const result = handleNoSlotsAvailable();

      expect(result.vocalMessage).toContain("desole");
    });
  });

  describe("getVocalMessage", () => {
    it("should return the correct message for each error type", () => {
      const types: VocalErrorResponse["errorType"][] = [
        "timeout",
        "client_error",
        "server_error",
        "no_slots",
      ];

      for (const type of types) {
        const message = getVocalMessage(type);
        expect(message).toBeTruthy();
        expect(typeof message).toBe("string");
        // All messages should be in French and conversational
        expect(message).toContain("desole");
      }
    });
  });

  describe("conversational tone (all types)", () => {
    it("all vocal messages should be polite and conversational", () => {
      const timeoutResult = handleCalcomError(new CalcomTimeoutError());
      const clientResult = handleCalcomError(new CalcomApiError(400, "Bad Request"));
      const serverResult = handleCalcomError(new CalcomApiError(500, "Internal Server Error"));
      const noSlotsResult = handleNoSlotsAvailable();

      const allMessages = [
        timeoutResult.vocalMessage,
        clientResult.vocalMessage,
        serverResult.vocalMessage,
        noSlotsResult.vocalMessage,
      ];

      for (const message of allMessages) {
        // All messages should start with an apology
        expect(message).toContain("desole");
        // All messages should be non-empty and substantial
        expect(message.length).toBeGreaterThan(30);
      }
    });
  });
});
