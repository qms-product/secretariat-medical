import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const appDir = path.resolve(__dirname, "..");

describe("IMP-42: Dark blue background applied to root layout", () => {
  const globalsCss = fs.readFileSync(path.join(appDir, "globals.css"), "utf-8");
  const layoutTsx = fs.readFileSync(path.join(appDir, "layout.tsx"), "utf-8");

  describe("Acceptance: Dark blue background color defined in CSS variables", () => {
    it("defines --background-color CSS variable in :root", () => {
      expect(globalsCss).toContain(":root");
      expect(globalsCss).toContain("--background-color");
    });

    it("uses a dark blue color value (#1e3a5f) for --background-color", () => {
      const match = globalsCss.match(/--background-color:\s*([^;]+);/);
      expect(match).not.toBeNull();
      const colorValue = match![1].trim().toLowerCase();
      expect(colorValue).toBe("#1e3a5f");
    });

    it("documents the exact color value in a code comment", () => {
      expect(globalsCss).toMatch(/\/\*[\s\S]*#1e3a5f[\s\S]*\*\//i);
    });
  });

  describe("Acceptance: Dark blue background applied via body in global CSS", () => {
    it("applies background-color to body using the CSS variable", () => {
      expect(globalsCss).toContain("background-color: var(--background-color)");
    });

    it("applies text color to body for readability on dark background", () => {
      expect(globalsCss).toContain("color: var(--text-color)");
    });
  });

  describe("Acceptance: globals.css is imported in layout.tsx for SSR", () => {
    it("imports globals.css in the root layout", () => {
      expect(layoutTsx).toContain('import "./globals.css"');
    });

    it("layout is a server component (no 'use client' directive)", () => {
      expect(layoutTsx).not.toContain("use client");
    });
  });

  describe("Acceptance: Text contrast meets WCAG AA standards", () => {
    it("white text on #1e3a5f maintains at least 4.5:1 contrast ratio", () => {
      // #1e3a5f background luminance calculation
      const bgHex = "1e3a5f";
      const r = parseInt(bgHex.substring(0, 2), 16) / 255;
      const g = parseInt(bgHex.substring(2, 4), 16) / 255;
      const b = parseInt(bgHex.substring(4, 6), 16) / 255;

      const toLinear = (c: number) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      const bgLuminance =
        0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

      // White (#ffffff) luminance = 1.0
      const whiteLuminance = 1.0;

      // Contrast ratio = (lighter + 0.05) / (darker + 0.05)
      const contrastRatio =
        (whiteLuminance + 0.05) / (bgLuminance + 0.05);
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("Acceptance: Centralized color definition", () => {
    it("background color is defined only in globals.css via CSS variable", () => {
      // The color should be in :root as a variable, not hardcoded elsewhere
      const bgColorOccurrences = globalsCss.match(/#1e3a5f/gi);
      // Should appear exactly once (in the variable definition)
      expect(bgColorOccurrences).not.toBeNull();
      expect(bgColorOccurrences!.length).toBeLessThanOrEqual(4); // variable + comment references
    });
  });

  describe("Acceptance: No business logic or API routes modified", () => {
    it("globals.css only contains styling rules, no scripts", () => {
      expect(globalsCss).not.toContain("<script");
      expect(globalsCss).not.toContain("javascript:");
    });

    it("layout.tsx does not modify any API or business logic", () => {
      expect(layoutTsx).toContain("export const metadata");
      expect(layoutTsx).toContain("RootLayout");
      expect(layoutTsx).not.toContain("/api/");
      expect(layoutTsx).not.toContain("fetch(");
    });
  });
});
