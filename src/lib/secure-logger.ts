/**
 * Secure Logger with Patient Data Sanitization (IMP-39 / REQ-100)
 *
 * Provides a logging wrapper that automatically masks sensitive patient data
 * (names, emails, phone numbers, etc.) before writing to console.
 * Masking rules are configurable via SanitizationRule[].
 */

/** A rule that defines a pattern to detect and how to mask it. */
export interface SanitizationRule {
  /** Human-readable name for the rule */
  name: string;
  /** Regular expression to detect the sensitive pattern */
  pattern: RegExp;
  /** Replacement string or function */
  replacement: string | ((...args: string[]) => string);
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface SecureLoggerConfig {
  /** Minimum log level (default: "info") */
  level: LogLevel;
  /** Prefix for all log messages */
  prefix?: string;
  /** Sanitization rules to apply */
  rules: SanitizationRule[];
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Default sanitization rules for patient data.
 * These cover the most common PII patterns in a French medical context.
 */
export const DEFAULT_SANITIZATION_RULES: SanitizationRule[] = [
  {
    name: "email",
    pattern: /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL MASQUÉ]",
  },
  {
    name: "french-phone",
    // Matches French phone numbers: 0X XX XX XX XX, +33X XX XX XX XX, 0033X...
    pattern: /(?:\+33|0033|0)\s?[1-9](?:[\s.\-]?\d{2}){4}/g,
    replacement: "[TÉL MASQUÉ]",
  },
  {
    name: "patient-name-json",
    // Matches "name": "..." or "nom": "..." in JSON-like strings
    pattern: /"(name|nom|nomPatient|patientName)"\s*:\s*"[^"]*"/gi,
    replacement: '"$1": "[NOM MASQUÉ]"',
  },
  {
    name: "patient-email-json",
    // Matches "email": "..." in JSON-like strings
    pattern: /"(email)"\s*:\s*"[^"]*"/gi,
    replacement: '"$1": "[EMAIL MASQUÉ]"',
  },
  {
    name: "patient-phone-json",
    // Matches "phone" or "telephone": "..." in JSON-like strings
    pattern: /"(phone|telephone|tel)"\s*:\s*"[^"]*"/gi,
    replacement: '"$1": "[TÉL MASQUÉ]"',
  },
];

/**
 * Sanitize a string by applying all configured rules.
 */
export function sanitize(
  value: string,
  rules: SanitizationRule[] = DEFAULT_SANITIZATION_RULES
): string {
  let result = value;
  for (const rule of rules) {
    // Reset regex lastIndex for global patterns
    if (rule.pattern.global) {
      rule.pattern.lastIndex = 0;
    }
    result = result.replace(rule.pattern, rule.replacement as string);
  }
  return result;
}

/**
 * Sanitize any value for safe logging.
 * Handles strings, objects (JSON-serialized then sanitized), and primitives.
 */
export function sanitizeValue(
  value: unknown,
  rules: SanitizationRule[] = DEFAULT_SANITIZATION_RULES
): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "string") {
    return sanitize(value, rules);
  }

  if (value instanceof Error) {
    const sanitizedMessage = sanitize(value.message, rules);
    const sanitizedStack = value.stack
      ? sanitize(value.stack, rules)
      : undefined;
    return sanitizedStack
      ? `${sanitizedMessage}\n${sanitizedStack}`
      : sanitizedMessage;
  }

  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return sanitize(json, rules);
    } catch {
      return sanitize(String(value), rules);
    }
  }

  return String(value);
}

/**
 * Create a secure logger instance with configurable rules and log level.
 */
export function createSecureLogger(config: Partial<SecureLoggerConfig> = {}) {
  const resolvedConfig: SecureLoggerConfig = {
    level: config.level ?? "info",
    prefix: config.prefix,
    rules: config.rules ?? DEFAULT_SANITIZATION_RULES,
  };

  function shouldLog(level: LogLevel): boolean {
    return (
      LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[resolvedConfig.level]
    );
  }

  function formatArgs(args: unknown[]): string[] {
    return args.map((arg) => sanitizeValue(arg, resolvedConfig.rules));
  }

  function buildMessage(level: LogLevel, args: unknown[]): string[] {
    const sanitized = formatArgs(args);
    if (resolvedConfig.prefix) {
      return [`[${resolvedConfig.prefix}]`, ...sanitized];
    }
    return sanitized;
  }

  return {
    debug(...args: unknown[]) {
      if (shouldLog("debug")) {
        console.log(...buildMessage("debug", args));
      }
    },

    info(...args: unknown[]) {
      if (shouldLog("info")) {
        console.log(...buildMessage("info", args));
      }
    },

    warn(...args: unknown[]) {
      if (shouldLog("warn")) {
        console.warn(...buildMessage("warn", args));
      }
    },

    error(...args: unknown[]) {
      if (shouldLog("error")) {
        console.error(...buildMessage("error", args));
      }
    },

    /** Get current configuration (for inspection/testing) */
    getConfig(): Readonly<SecureLoggerConfig> {
      return { ...resolvedConfig, rules: [...resolvedConfig.rules] };
    },
  };
}

/** Singleton secure logger for the application */
let defaultLogger: ReturnType<typeof createSecureLogger> | null = null;

export function getSecureLogger(): ReturnType<typeof createSecureLogger> {
  if (!defaultLogger) {
    const level = (process.env.LOG_LEVEL as LogLevel) ?? "info";
    defaultLogger = createSecureLogger({ level });
  }
  return defaultLogger;
}

/** Reset singleton (for testing) */
export function _resetSecureLogger(): void {
  defaultLogger = null;
}
