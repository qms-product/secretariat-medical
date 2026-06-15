import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getEnvDefaults, getEnvVar } from "../env";

const ROOT = resolve(__dirname, "../../..");

describe("Port configuration (IMP-29, ADR-10)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should configure dev script to use port 3001", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(ROOT, "package.json"), "utf-8")
    );
    expect(pkg.scripts.dev).toContain("3001");
  });

  it("should configure start script to use port 3001", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(ROOT, "package.json"), "utf-8")
    );
    expect(pkg.scripts.start).toContain("3001");
  });

  it("should expose port 3001 in Dockerfile", () => {
    const dockerfile = readFileSync(resolve(ROOT, "Dockerfile"), "utf-8");
    expect(dockerfile).toContain("EXPOSE 3001");
  });

  it("should set PORT=3001 in Dockerfile", () => {
    const dockerfile = readFileSync(resolve(ROOT, "Dockerfile"), "utf-8");
    expect(dockerfile).toContain("ENV PORT=3001");
  });

  it("should map port 3001 in docker-compose.yml", () => {
    const compose = readFileSync(
      resolve(ROOT, "docker-compose.yml"),
      "utf-8"
    );
    expect(compose).toContain("3001:3001");
  });

  it("should have PORT=3001 as default in env module", () => {
    const defaults = getEnvDefaults();
    expect(defaults.PORT).toBe("3001");
  });

  it("should return default PORT 3001 when not set", () => {
    const value = getEnvVar("PORT");
    expect(value).toBe("3001");
  });

  it("should allow overriding PORT via environment variable", () => {
    vi.stubEnv("PORT", "4000");
    const value = getEnvVar("PORT");
    expect(value).toBe("4000");
  });

  it("should not conflict with Cal.com port 3000", () => {
    const compose = readFileSync(
      resolve(ROOT, "docker-compose.yml"),
      "utf-8"
    );
    expect(compose).not.toContain("3000:3000");
  });

  it("should document PORT in .env.example", () => {
    const envExample = readFileSync(resolve(ROOT, ".env.example"), "utf-8");
    expect(envExample).toContain("PORT=3001");
  });
});
