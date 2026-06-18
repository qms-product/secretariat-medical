import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * IMP-50: Tests for dark blue background applied to root layout.
 * Verifies acceptance criteria for consistent dark blue background across the application.
 */

const globalsCssPath = path.resolve(__dirname, "../../app/globals.css");
const layoutPath = path.resolve(__dirname, "../../app/layout.tsx");

describe("IMP-50: Dark blue background", () => {
  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");
  const layoutTsx = fs.readFileSync(layoutPath, "utf-8");

  it("should define --background-color as dark blue #1e3a5f in globals.css", () => {
    expect(globalsCss).toContain("--background-color: #1e3a5f");
  });

  it("should define --text-color as white #ffffff in globals.css", () => {
    expect(globalsCss).toContain("--text-color: #ffffff");
  });

  it("should apply background-color via CSS custom property on body", () => {
    expect(globalsCss).toContain("background-color: var(--background-color)");
  });

  it("should apply text color via CSS custom property on body", () => {
    expect(globalsCss).toContain("color: var(--text-color)");
  });

  it("should set body min-height to 100vh for full-page coverage", () => {
    expect(globalsCss).toContain("min-height: 100vh");
  });

  it("should document the color value and WCAG contrast ratio", () => {
    // Verify documentation exists in either globals.css or layout.tsx
    const hasDocInCss = globalsCss.includes("#1e3a5f") && globalsCss.includes("dark blue");
    const hasDocInLayout = layoutTsx.includes("#1e3a5f") && layoutTsx.includes("WCAG");
    expect(hasDocInCss || hasDocInLayout).toBe(true);
  });

  it("should have WCAG AA compliant contrast ratio (white on #1e3a5f)", () => {
    // #1e3a5f RGB: (30, 58, 95)
    // #ffffff RGB: (255, 255, 255)
    // Relative luminance calculation per WCAG 2.0
    function sRGBtoLinear(c: number): number {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    function luminance(r: number, g: number, b: number): number {
      return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
    }
    const bgLum = luminance(30, 58, 95);   // #1e3a5f
    const textLum = luminance(255, 255, 255); // #ffffff
    const ratio = (textLum + 0.05) / (bgLum + 0.05);

    // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("should import globals.css in the root layout", () => {
    expect(layoutTsx).toContain('./globals.css"');
  });

  it("should render html with lang='fr' in root layout", () => {
    expect(layoutTsx).toContain('lang="fr"');
  });

  it("should render body element in root layout", () => {
    expect(layoutTsx).toContain("<body>");
  });
});
