import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * IMP-44: Dark blue background applied to application layout.
 * Tests verify that the dark blue background is correctly defined and applied.
 */

const ROOT = resolve(__dirname, "../../..");

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

describe("IMP-44: Dark blue background", () => {
  describe("Acceptance: Toutes les pages affichent un fond bleu foncé", () => {
    it("globals.css defines --background-color as a dark blue shade", () => {
      const css = readFile("src/app/globals.css");
      expect(css).toContain("--background-color:");
      // Must be a dark blue color (#1e3a5f)
      expect(css).toMatch(/--background-color:\s*#1e3a5f/);
    });

    it("globals.css applies background-color to body via CSS variable", () => {
      const css = readFile("src/app/globals.css");
      expect(css).toContain("background-color: var(--background-color)");
    });
  });

  describe("Acceptance: Couleur de fond appliquée de manière cohérente via layout", () => {
    it("layout.tsx applies background-color via CSS variable on body", () => {
      const layout = readFile("src/app/layout.tsx");
      expect(layout).toContain("--background-color");
    });

    it("layout.tsx wraps children in body element", () => {
      const layout = readFile("src/app/layout.tsx");
      expect(layout).toContain("<body");
      expect(layout).toContain("{children}");
      expect(layout).toContain("</body>");
    });
  });

  describe("Acceptance: Contraste texte/fond adéquat (WCAG AA)", () => {
    it("globals.css defines white text color for contrast with dark blue", () => {
      const css = readFile("src/app/globals.css");
      expect(css).toMatch(/--text-color:\s*#ffffff/);
    });

    it("globals.css applies text color to body via CSS variable", () => {
      const css = readFile("src/app/globals.css");
      expect(css).toContain("color: var(--text-color)");
    });

    it("defines a muted text color for secondary text", () => {
      const css = readFile("src/app/globals.css");
      expect(css).toContain("--text-color-muted:");
    });

    it("page.tsx uses muted CSS variable instead of hardcoded dark color", () => {
      const page = readFile("src/app/page.tsx");
      // The subtitle should use the muted variable, not a dark hex color like #666
      expect(page).toContain("var(--text-color-muted)");
      expect(page).not.toMatch(/color:\s*["']#666["']/);
    });
  });

  describe("Acceptance: Style n'interfère pas avec les composants existants", () => {
    it("ErrorDisplay keeps its own functional background color", () => {
      const component = readFile("src/components/ErrorDisplay.tsx");
      expect(component).toContain("backgroundColor");
      expect(component).toContain("#fdf0ef");
    });

    it("ResponseDisplay keeps its own functional background color", () => {
      const component = readFile("src/components/ResponseDisplay.tsx");
      expect(component).toContain("backgroundColor");
      expect(component).toContain("#f0faf0");
    });

    it("TranscriptDisplay keeps its own functional background color", () => {
      const component = readFile("src/components/TranscriptDisplay.tsx");
      expect(component).toContain("backgroundColor");
      expect(component).toContain("#f0f4f8");
    });
  });

  describe("Acceptance: Couleur bleu foncé définie comme variable CSS réutilisable", () => {
    it("background color is defined as a CSS custom property in :root", () => {
      const css = readFile("src/app/globals.css");
      expect(css).toContain(":root");
      expect(css).toContain("--background-color:");
    });

    it("body references the CSS variable, not a hardcoded value", () => {
      const css = readFile("src/app/globals.css");
      const bodyBlock = css.substring(css.indexOf("body {"));
      expect(bodyBlock).toContain("var(--background-color)");
      expect(bodyBlock).not.toMatch(/background-color:\s*#[0-9a-fA-F]{6}/);
    });
  });
});
