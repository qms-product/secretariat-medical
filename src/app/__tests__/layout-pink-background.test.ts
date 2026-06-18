import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const appDir = path.resolve(__dirname, "..");

describe("IMP-41: Pink background applied to application layout", () => {
  const globalsCss = fs.readFileSync(path.join(appDir, "globals.css"), "utf-8");
  const layoutTsx = fs.readFileSync(path.join(appDir, "layout.tsx"), "utf-8");

  describe("Acceptance: Pink background color defined in CSS variables", () => {
    it("defines --background-color CSS variable in :root", () => {
      expect(globalsCss).toContain(":root");
      expect(globalsCss).toContain("--background-color");
    });

    it("uses a pink color value for --background-color", () => {
      // #FFF0F5 is lavender blush (pink)
      const match = globalsCss.match(/--background-color:\s*([^;]+);/);
      expect(match).not.toBeNull();
      const colorValue = match![1].trim().toLowerCase();
      expect(colorValue).toBe("#fff0f5");
    });
  });

  describe("Acceptance: Pink background applied via body in global CSS", () => {
    it("applies background-color to body using the CSS variable", () => {
      expect(globalsCss).toContain("background-color: var(--background-color)");
    });
  });

  describe("Acceptance: globals.css is imported in layout.tsx", () => {
    it("imports globals.css in the root layout", () => {
      expect(layoutTsx).toContain('import "./globals.css"');
    });
  });

  describe("Acceptance: Text contrast meets WCAG AA standards", () => {
    it("uses a light pink that maintains 4.5:1 contrast with black text", () => {
      // #FFF0F5 (lavender blush) has luminance ~0.92
      // Black (#000000) has luminance 0.0
      // Contrast ratio = (0.92 + 0.05) / (0.0 + 0.05) = 19.4:1
      // This exceeds WCAG AA minimum of 4.5:1
      const match = globalsCss.match(/--background-color:\s*#([0-9a-fA-F]{6});/);
      expect(match).not.toBeNull();

      const hex = match![1];
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;

      // sRGB to linear
      const toLinear = (c: number) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      const luminance =
        0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

      // Contrast ratio with black (luminance = 0)
      const contrastWithBlack = (luminance + 0.05) / 0.05;
      expect(contrastWithBlack).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("Acceptance: No business logic or API routes modified", () => {
    it("globals.css only contains styling rules, no scripts", () => {
      expect(globalsCss).not.toContain("<script");
      expect(globalsCss).not.toContain("javascript:");
    });

    it("layout.tsx does not modify any API or business logic", () => {
      // Layout should only contain metadata and structural HTML
      expect(layoutTsx).toContain("export const metadata");
      expect(layoutTsx).toContain("RootLayout");
      expect(layoutTsx).not.toContain("/api/");
      expect(layoutTsx).not.toContain("fetch(");
    });
  });
});
