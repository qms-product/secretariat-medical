/**
 * Environment variable validation for API keys (ADR-1, IMP-4).
 * All API keys are server-side only — never prefixed with NEXT_PUBLIC_.
 */

const REQUIRED_ENV_VARS = [
  "ELEVENLABS_API_KEY",
  "ANTHROPIC_API_KEY",
] as const;

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
