import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateEnv, getRequiredEnvVars } from "../env";

describe("Environment variable validation (IMP-4)", () => {
  beforeEach(() => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return valid when all required env vars are set", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-elevenlabs-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");

    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("should detect missing ELEVENLABS_API_KEY", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("ELEVENLABS_API_KEY");
  });

  it("should detect missing ANTHROPIC_API_KEY", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-elevenlabs-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("ANTHROPIC_API_KEY");
  });

  it("should detect all missing env vars", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("ELEVENLABS_API_KEY");
    expect(result.missing).toContain("ANTHROPIC_API_KEY");
  });

  it("should reject whitespace-only values", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "   ");
    vi.stubEnv("ANTHROPIC_API_KEY", "  \t  ");

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(2);
  });

  it("should list all required env var names", () => {
    const required = getRequiredEnvVars();
    expect(required).toContain("ELEVENLABS_API_KEY");
    expect(required).toContain("ANTHROPIC_API_KEY");
    expect(required).toHaveLength(2);
  });

  it("should not require any NEXT_PUBLIC_ prefixed variables", () => {
    const required = getRequiredEnvVars();
    for (const key of required) {
      expect(key).not.toMatch(/^NEXT_PUBLIC_/);
    }
  });
});
