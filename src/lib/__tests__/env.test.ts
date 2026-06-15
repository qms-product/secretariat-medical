import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateEnv, getRequiredEnvVars, getEnvDefaults, getEnvVar } from "../env";

function stubAllRequired() {
  vi.stubEnv("ELEVENLABS_API_KEY", "test-elevenlabs-key");
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  vi.stubEnv("CAL_COM_API_KEY", "test-calcom-key");
  vi.stubEnv("CAL_COM_EVENT_TYPE_ID", "123");
}

function clearAllRequired() {
  vi.stubEnv("ELEVENLABS_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("CAL_COM_API_KEY", "");
  vi.stubEnv("CAL_COM_EVENT_TYPE_ID", "");
}

describe("Environment variable validation (IMP-4)", () => {
  beforeEach(() => {
    clearAllRequired();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return valid when all required env vars are set", () => {
    stubAllRequired();

    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("should detect missing ELEVENLABS_API_KEY", () => {
    stubAllRequired();
    vi.stubEnv("ELEVENLABS_API_KEY", "");

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("ELEVENLABS_API_KEY");
  });

  it("should detect missing ANTHROPIC_API_KEY", () => {
    stubAllRequired();
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("ANTHROPIC_API_KEY");
  });

  it("should detect all missing env vars", () => {
    clearAllRequired();

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("ELEVENLABS_API_KEY");
    expect(result.missing).toContain("ANTHROPIC_API_KEY");
    expect(result.missing).toContain("CAL_COM_API_KEY");
    expect(result.missing).toContain("CAL_COM_EVENT_TYPE_ID");
  });

  it("should reject whitespace-only values", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "   ");
    vi.stubEnv("ANTHROPIC_API_KEY", "  \t  ");
    vi.stubEnv("CAL_COM_API_KEY", "  ");
    vi.stubEnv("CAL_COM_EVENT_TYPE_ID", " ");

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(4);
  });

  it("should list all required env var names", () => {
    const required = getRequiredEnvVars();
    expect(required).toContain("ELEVENLABS_API_KEY");
    expect(required).toContain("ANTHROPIC_API_KEY");
    expect(required).toContain("CAL_COM_API_KEY");
    expect(required).toContain("CAL_COM_EVENT_TYPE_ID");
    expect(required).toHaveLength(4);
  });

  it("should not require any NEXT_PUBLIC_ prefixed variables", () => {
    const required = getRequiredEnvVars();
    for (const key of required) {
      expect(key).not.toMatch(/^NEXT_PUBLIC_/);
    }
  });
});

describe("Cal.com environment variables (IMP-24)", () => {
  beforeEach(() => {
    clearAllRequired();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should detect missing CAL_COM_API_KEY", () => {
    stubAllRequired();
    vi.stubEnv("CAL_COM_API_KEY", "");

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("CAL_COM_API_KEY");
  });

  it("should detect missing CAL_COM_EVENT_TYPE_ID", () => {
    stubAllRequired();
    vi.stubEnv("CAL_COM_EVENT_TYPE_ID", "");

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("CAL_COM_EVENT_TYPE_ID");
  });

  it("should have a default value for CAL_COM_BASE_URL", () => {
    const defaults = getEnvDefaults();
    expect(defaults.CAL_COM_BASE_URL).toBe("http://localhost:3000");
  });

  it("should not require CAL_COM_BASE_URL (has default)", () => {
    const required = getRequiredEnvVars();
    expect(required).not.toContain("CAL_COM_BASE_URL");
  });

  it("should return default CAL_COM_BASE_URL when not set", () => {
    const value = getEnvVar("CAL_COM_BASE_URL");
    expect(value).toBe("http://localhost:3000");
  });

  it("should return explicit CAL_COM_BASE_URL when set", () => {
    vi.stubEnv("CAL_COM_BASE_URL", "https://cal.example.com");

    const value = getEnvVar("CAL_COM_BASE_URL");
    expect(value).toBe("https://cal.example.com");
  });

  it("should return undefined for unknown env var without default", () => {
    const value = getEnvVar("UNKNOWN_VAR");
    expect(value).toBeUndefined();
  });

  it("should fall back to default when value is whitespace-only", () => {
    vi.stubEnv("CAL_COM_BASE_URL", "   ");

    const value = getEnvVar("CAL_COM_BASE_URL");
    expect(value).toBe("http://localhost:3000");
  });
});

describe("CALCOM_DATABASE_URL environment variable (IMP-30, ADR-11)", () => {
  beforeEach(() => {
    clearAllRequired();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should have a default value for CALCOM_DATABASE_URL", () => {
    const defaults = getEnvDefaults();
    expect(defaults.CALCOM_DATABASE_URL).toBe(
      "postgresql://calcom:calcom@localhost:5432/calcom"
    );
  });

  it("should not require CALCOM_DATABASE_URL (has default)", () => {
    const required = getRequiredEnvVars();
    expect(required).not.toContain("CALCOM_DATABASE_URL");
  });

  it("should return default CALCOM_DATABASE_URL when not set", () => {
    const value = getEnvVar("CALCOM_DATABASE_URL");
    expect(value).toBe("postgresql://calcom:calcom@localhost:5432/calcom");
  });

  it("should return explicit CALCOM_DATABASE_URL when set", () => {
    vi.stubEnv(
      "CALCOM_DATABASE_URL",
      "postgresql://user:pass@prod-host:5432/calcom"
    );

    const value = getEnvVar("CALCOM_DATABASE_URL");
    expect(value).toBe("postgresql://user:pass@prod-host:5432/calcom");
  });

  it("should fall back to default when CALCOM_DATABASE_URL is whitespace-only", () => {
    vi.stubEnv("CALCOM_DATABASE_URL", "   ");

    const value = getEnvVar("CALCOM_DATABASE_URL");
    expect(value).toBe("postgresql://calcom:calcom@localhost:5432/calcom");
  });
});
