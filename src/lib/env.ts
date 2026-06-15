/**
 * Environment variable validation for API keys (ADR-1, IMP-4, IMP-24).
 * All API keys are server-side only — never prefixed with NEXT_PUBLIC_.
 */

const REQUIRED_ENV_VARS = [
  "ELEVENLABS_API_KEY",
  "ANTHROPIC_API_KEY",
  "CAL_COM_API_KEY",
  "CAL_COM_EVENT_TYPE_ID",
] as const;

/**
 * Environment variables with default values.
 * These are not required to be set explicitly.
 */
const ENV_DEFAULTS: Record<string, string> = {
  CAL_COM_BASE_URL: "http://localhost:3000",
  PORT: "3001",
} as const;

export type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
}

/**
 * Validates that all required environment variables are defined and non-empty.
 */
export function validateEnv(): EnvValidationResult {
  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === ""
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Returns the list of required environment variable names.
 */
export function getRequiredEnvVars(): readonly string[] {
  return REQUIRED_ENV_VARS;
}

/**
 * Returns the default values for optional environment variables.
 */
export function getEnvDefaults(): Readonly<Record<string, string>> {
  return ENV_DEFAULTS;
}

/**
 * Returns the value of an environment variable, falling back to its default if defined.
 */
export function getEnvVar(key: string): string | undefined {
  const value = process.env[key];
  if (value && value.trim() !== "") {
    return value;
  }
  return ENV_DEFAULTS[key];
}
