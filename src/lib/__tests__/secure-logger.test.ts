import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  sanitize,
  sanitizeValue,
  createSecureLogger,
  getSecureLogger,
  _resetSecureLogger,
  DEFAULT_SANITIZATION_RULES,
  type SanitizationRule,
} from "../secure-logger";

describe("secure-logger (IMP-39 / REQ-100)", () => {
  beforeEach(() => {
    _resetSecureLogger();
  });

  afterEach(() => {
    _resetSecureLogger();
    vi.restoreAllMocks();
  });

  describe("sanitize — email masking", () => {
    it("should mask email addresses in plain text", () => {
      const input = "Patient jean.leclerc@example.com a confirmé";
      const result = sanitize(input);
      expect(result).toBe("Patient [EMAIL MASQUÉ] a confirmé");
      expect(result).not.toContain("jean.leclerc@example.com");
    });

    it("should mask multiple email addresses", () => {
      const input = "Emails: a@b.fr et c@d.com";
      const result = sanitize(input);
      expect(result).toBe("Emails: [EMAIL MASQUÉ] et [EMAIL MASQUÉ]");
    });

    it("should mask email in JSON string", () => {
      const input = '{"email": "patient@clinique.fr"}';
      const result = sanitize(input);
      expect(result).not.toContain("patient@clinique.fr");
      expect(result).toContain("[EMAIL MASQUÉ]");
    });
  });

  describe("sanitize — phone number masking", () => {
    it("should mask French phone numbers (06 format)", () => {
      const input = "Téléphone: 06 12 34 56 78";
      const result = sanitize(input);
      expect(result).toBe("Téléphone: [TÉL MASQUÉ]");
      expect(result).not.toContain("06 12 34 56 78");
    });

    it("should mask phone numbers without spaces", () => {
      const input = "Tel: 0612345678";
      const result = sanitize(input);
      expect(result).toContain("[TÉL MASQUÉ]");
      expect(result).not.toContain("0612345678");
    });

    it("should mask phone numbers with international prefix", () => {
      const input = "Tel: +33612345678";
      const result = sanitize(input);
      expect(result).toContain("[TÉL MASQUÉ]");
      expect(result).not.toContain("+33612345678");
    });

    it("should mask phone numbers with dots", () => {
      const input = "Tel: 01.23.45.67.89";
      const result = sanitize(input);
      expect(result).toContain("[TÉL MASQUÉ]");
      expect(result).not.toContain("01.23.45.67.89");
    });

    it("should mask phone in JSON string", () => {
      const input = '{"phone": "06 12 34 56 78"}';
      const result = sanitize(input);
      expect(result).not.toContain("06 12 34 56 78");
    });
  });

  describe("sanitize — patient name masking in JSON", () => {
    it('should mask "name" field in JSON', () => {
      const input = '{"name": "Jean Leclerc"}';
      const result = sanitize(input);
      expect(result).toContain("[NOM MASQUÉ]");
      expect(result).not.toContain("Jean Leclerc");
    });

    it('should mask "patientName" field in JSON', () => {
      const input = '{"patientName": "Sophie Bernard"}';
      const result = sanitize(input);
      expect(result).toContain("[NOM MASQUÉ]");
      expect(result).not.toContain("Sophie Bernard");
    });

    it('should mask "nom" field in JSON', () => {
      const input = '{"nom": "Pierre Moreau"}';
      const result = sanitize(input);
      expect(result).toContain("[NOM MASQUÉ]");
      expect(result).not.toContain("Pierre Moreau");
    });

    it('should mask "nomPatient" field in JSON', () => {
      const input = '{"nomPatient": "Marie Martin"}';
      const result = sanitize(input);
      expect(result).toContain("[NOM MASQUÉ]");
      expect(result).not.toContain("Marie Martin");
    });
  });

  describe("sanitize — combined sensitive data", () => {
    it("should mask all sensitive fields in a patient info JSON", () => {
      const input = JSON.stringify({
        name: "Jean Leclerc",
        email: "jean@example.com",
        phone: "06 12 34 56 78",
      });
      const result = sanitize(input);
      expect(result).not.toContain("Jean Leclerc");
      expect(result).not.toContain("jean@example.com");
      expect(result).not.toContain("06 12 34 56 78");
    });

    it("should not mask non-sensitive data", () => {
      const input = "Créneau slot-3 le 2026-06-10 à 11:00 avec Dr. Marie Dupont";
      const result = sanitize(input);
      expect(result).toContain("slot-3");
      expect(result).toContain("2026-06-10");
      expect(result).toContain("11:00");
      expect(result).toContain("Dr. Marie Dupont");
    });
  });

  describe("sanitizeValue", () => {
    it("should handle null and undefined", () => {
      expect(sanitizeValue(null)).toBe("null");
      expect(sanitizeValue(undefined)).toBe("undefined");
    });

    it("should sanitize string values", () => {
      const result = sanitizeValue("Contact: patient@test.fr");
      expect(result).toContain("[EMAIL MASQUÉ]");
    });

    it("should sanitize objects by JSON-serializing then sanitizing", () => {
      const obj = { name: "Jean Leclerc", email: "jean@test.fr" };
      const result = sanitizeValue(obj);
      expect(result).not.toContain("Jean Leclerc");
      expect(result).not.toContain("jean@test.fr");
    });

    it("should sanitize Error objects", () => {
      const err = new Error("Failed for patient jean@test.fr");
      const result = sanitizeValue(err);
      expect(result).not.toContain("jean@test.fr");
      expect(result).toContain("[EMAIL MASQUÉ]");
    });

    it("should handle numbers and booleans as-is", () => {
      expect(sanitizeValue(42)).toBe("42");
      expect(sanitizeValue(true)).toBe("true");
    });
  });

  describe("createSecureLogger — log levels", () => {
    it("should respect minimum log level", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const logger = createSecureLogger({ level: "warn" });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("should log all levels when level is debug", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const logger = createSecureLogger({ level: "debug" });

      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");

      expect(logSpy).toHaveBeenCalledTimes(2); // debug + info
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("createSecureLogger — sanitization in output", () => {
    it("should sanitize patient data in log output", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const logger = createSecureLogger({ level: "error" });
      logger.error("Error for patient", { name: "Jean", email: "jean@test.fr", phone: "0612345678" });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const loggedArgs = errorSpy.mock.calls[0];
      const fullOutput = loggedArgs.join(" ");
      expect(fullOutput).not.toContain("jean@test.fr");
      expect(fullOutput).not.toContain("0612345678");
    });

    it("should include prefix when configured", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const logger = createSecureLogger({ prefix: "secure", level: "info" });
      logger.info("test message");

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toBe("[secure]");
    });
  });

  describe("createSecureLogger — configurable rules", () => {
    it("should allow custom sanitization rules", () => {
      const customRules: SanitizationRule[] = [
        {
          name: "custom-id",
          pattern: /PATIENT-\d+/g,
          replacement: "[ID MASQUÉ]",
        },
      ];

      const logger = createSecureLogger({ rules: customRules, level: "info" });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      logger.info("Processing PATIENT-12345");

      const fullOutput = logSpy.mock.calls[0].join(" ");
      expect(fullOutput).toContain("[ID MASQUÉ]");
      expect(fullOutput).not.toContain("PATIENT-12345");
    });

    it("should expose configuration via getConfig", () => {
      const logger = createSecureLogger({ level: "warn", prefix: "test" });
      const config = logger.getConfig();

      expect(config.level).toBe("warn");
      expect(config.prefix).toBe("test");
      expect(config.rules).toEqual(DEFAULT_SANITIZATION_RULES);
    });
  });

  describe("getSecureLogger — singleton", () => {
    it("should return the same instance on subsequent calls", () => {
      const logger1 = getSecureLogger();
      const logger2 = getSecureLogger();
      expect(logger1).toBe(logger2);
    });

    it("should return a new instance after reset", () => {
      const logger1 = getSecureLogger();
      _resetSecureLogger();
      const logger2 = getSecureLogger();
      expect(logger1).not.toBe(logger2);
    });
  });

  describe("acceptance criteria", () => {
    it("AC1: Les données patient sont masquées dans les logs", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logger = createSecureLogger({ level: "error" });

      const patientData = {
        name: "Jean Leclerc",
        email: "jean.leclerc@example.com",
        phone: "06 12 34 56 78",
      };

      logger.error("Erreur lors du traitement:", patientData);

      const fullOutput = errorSpy.mock.calls[0].join(" ");
      expect(fullOutput).not.toContain("Jean Leclerc");
      expect(fullOutput).not.toContain("jean.leclerc@example.com");
      expect(fullOutput).not.toContain("06 12 34 56 78");
    });

    it("AC2: Les logs ne contiennent pas d'informations sensibles", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const logger = createSecureLogger({ level: "warn" });

      logger.warn(
        `[rate-limit] IP bloquée: 192.168.1.1 | Patient: jean@test.fr | Tel: 0612345678`
      );

      const fullOutput = warnSpy.mock.calls[0].join(" ");
      expect(fullOutput).not.toContain("jean@test.fr");
      expect(fullOutput).not.toContain("0612345678");
      // IP is kept (not patient PII by default)
      expect(fullOutput).toContain("192.168.1.1");
    });

    it("AC3: Un système de logging sécurisé est implémenté", () => {
      const logger = createSecureLogger({ level: "info" });
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    it("AC4: Les règles de masquage sont configurables", () => {
      const customRules: SanitizationRule[] = [
        {
          name: "ssn",
          pattern: /\d{3}-\d{2}-\d{4}/g,
          replacement: "[SSN MASQUÉ]",
        },
      ];

      const logger = createSecureLogger({ rules: customRules });
      const config = logger.getConfig();

      expect(config.rules).toHaveLength(1);
      expect(config.rules[0].name).toBe("ssn");

      // Verify the custom rule works
      const result = sanitize("SSN: 123-45-6789", customRules);
      expect(result).toBe("SSN: [SSN MASQUÉ]");
    });
  });
});
