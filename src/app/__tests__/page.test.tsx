import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import Home from "../page";

// --- Mocks ---

const mockGetUserMedia = vi.fn();
const mockMediaRecorderStart = vi.fn();
const mockMediaRecorderStop = vi.fn();


class MockMediaRecorder {
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state = "inactive";
  start = mockMediaRecorderStart.mockImplementation(() => {
    this.state = "recording";
  });
  stop = mockMediaRecorderStop.mockImplementation(() => {
    this.state = "inactive";
    setTimeout(() => this.onstop?.(), 0);
  });
  stream = { getTracks: () => [{ stop: vi.fn() }] };

}

function setupBrowserMocks() {
  Object.defineProperty(globalThis, "MediaRecorder", {
    value: MockMediaRecorder,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
    configurable: true,
  });
}

const mockSourceStart = vi.fn();
const mockSourceConnect = vi.fn();
let mockSourceOnended: (() => void) | null = null;
const mockDecodeAudioData = vi.fn().mockResolvedValue({});

function setupAudioContextMock() {
  vi.stubGlobal("AudioContext", vi.fn(() => ({
    decodeAudioData: mockDecodeAudioData,
    destination: {},
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: mockSourceConnect,
      start: mockSourceStart,
      set onended(fn: () => void) {
        mockSourceOnended = fn;
      },
      get onended() {
        return mockSourceOnended;
      },
    })),
  })));
}

describe("Home page — ProgressIndicators integration (IMP-14 / ADR-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSourceOnended = null;
    setupBrowserMocks();
    setupAudioContextMock();
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });
  });

  afterEach(cleanup);

  describe("Acceptance: Indicateurs affichés sur la page principale", () => {
    it("does not show progress indicators when idle", () => {
      render(<Home />);
      expect(screen.queryByTestId("progress-indicators")).toBeNull();
    });

    it("shows progress indicators once recording starts", async () => {
      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });
      expect(screen.getByTestId("progress-indicators")).toBeDefined();
    });
  });

  describe("Acceptance: Indicateur enregistrement actif pendant MediaRecorder (REQ-31)", () => {
    it("activates the capture indicator when recording", async () => {
      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });
      const step = screen.getByTestId("step-capture");
      expect(step).toHaveAttribute("data-active", "true");
    });
  });

  describe("Acceptance: Indicateur transcription actif pendant appel STT (REQ-32)", () => {
    it("activates the transcription indicator during STT call", async () => {
      render(<Home />);

      // Start recording
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      // Mock fetch for STT — this will hang to keep us in transcription state
      let resolveStt: (value: unknown) => void;
      const sttPromise = new Promise((resolve) => { resolveStt = resolve; });
      vi.stubGlobal("fetch", vi.fn(() => sttPromise));

      // Stop recording
      await act(async () => {
        fireEvent.click(screen.getByText(/Arreter/));
      });
      // Wait for MediaRecorder.onstop to fire
      await act(async () => {
        await vi.waitFor(() => {});
      });

      const step = screen.getByTestId("step-transcription");
      expect(step).toHaveAttribute("data-active", "true");
      expect(screen.getByTestId("step-capture")).toHaveAttribute("data-completed", "true");

      // Resolve to avoid hanging
      resolveStt!({ ok: true, json: () => Promise.resolve({ text: "test" }) });
    });
  });

  describe("Acceptance: Indicateur réflexion actif pendant appel Claude (REQ-33)", () => {
    it("activates the processing indicator during Claude call", async () => {
      render(<Home />);

      // Start recording
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      // Set up fetch to respond to STT, then hang on LLM
      let resolveLlm: (value: unknown) => void;
      const llmPromise = new Promise((resolve) => { resolveLlm = resolve; });
      let fetchCallCount = 0;
      vi.stubGlobal("fetch", vi.fn(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          // STT response
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ text: "Bonjour" }),
          });
        }
        // LLM — hang
        return llmPromise;
      }));

      // Stop recording
      await act(async () => {
        fireEvent.click(screen.getByText(/Arreter/));
      });
      await act(async () => {
        await vi.waitFor(() => {});
      });

      // Wait for transcription to complete and processing to start
      await waitFor(() => {
        expect(screen.getByTestId("step-processing")).toHaveAttribute("data-active", "true");
      });

      expect(screen.getByTestId("step-capture")).toHaveAttribute("data-completed", "true");
      expect(screen.getByTestId("step-transcription")).toHaveAttribute("data-completed", "true");

      // Resolve to avoid hanging
      resolveLlm!({ ok: true, json: () => Promise.resolve({ reply: "Bienvenue" }) });
    });
  });

  describe("Acceptance: Indicateur lecture actif pendant lecture audio (REQ-34)", () => {
    it("activates the playing indicator during audio playback", async () => {
      render(<Home />);

      // Start recording
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      // Set up fetch for full flow
      let fetchCallCount = 0;
      vi.stubGlobal("fetch", vi.fn(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ text: "Bonjour" }),
          });
        }
        if (fetchCallCount === 2) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ reply: "Bienvenue" }),
          });
        }
        // TTS
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        });
      }));

      // Stop recording
      await act(async () => {
        fireEvent.click(screen.getByText(/Arreter/));
      });
      await act(async () => {
        await vi.waitFor(() => {});
      });

      // Wait for playing state
      await waitFor(() => {
        expect(screen.getByTestId("step-playing")).toHaveAttribute("data-active", "true");
      });

      expect(screen.getByTestId("step-capture")).toHaveAttribute("data-completed", "true");
      expect(screen.getByTestId("step-transcription")).toHaveAttribute("data-completed", "true");
      expect(screen.getByTestId("step-processing")).toHaveAttribute("data-completed", "true");
    });
  });

  describe("Acceptance: Gestion d'erreur avec reset des indicateurs", () => {
    it("hides indicators when an error occurs during transcription", async () => {
      render(<Home />);

      // Start recording
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      // STT fails
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({ ok: false })
      ));

      // Stop recording
      await act(async () => {
        fireEvent.click(screen.getByText(/Arreter/));
      });
      await act(async () => {
        await vi.waitFor(() => {});
      });

      // Wait for error handling to reset status to idle
      await waitFor(() => {
        expect(screen.queryByTestId("progress-indicators")).toBeNull();
      });
    });

    it("hides indicators when an error occurs during processing", async () => {
      render(<Home />);

      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      let fetchCallCount = 0;
      vi.stubGlobal("fetch", vi.fn(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ text: "Bonjour" }),
          });
        }
        // LLM fails
        return Promise.resolve({ ok: false });
      }));

      await act(async () => {
        fireEvent.click(screen.getByText(/Arreter/));
      });
      await act(async () => {
        await vi.waitFor(() => {});
      });

      await waitFor(() => {
        expect(screen.queryByTestId("progress-indicators")).toBeNull();
      });
    });

    it("hides indicators when an error occurs during synthesis", async () => {
      render(<Home />);

      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      let fetchCallCount = 0;
      vi.stubGlobal("fetch", vi.fn(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ text: "Bonjour" }),
          });
        }
        if (fetchCallCount === 2) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ reply: "Bienvenue" }),
          });
        }
        // TTS fails
        return Promise.resolve({ ok: false });
      }));

      await act(async () => {
        fireEvent.click(screen.getByText(/Arreter/));
      });
      await act(async () => {
        await vi.waitFor(() => {});
      });

      await waitFor(() => {
        expect(screen.queryByTestId("progress-indicators")).toBeNull();
      });
    });

    it("shows error display when flow fails", async () => {
      render(<Home />);

      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({ ok: false })
      ));

      await act(async () => {
        fireEvent.click(screen.getByText(/Arreter/));
      });
      await act(async () => {
        await vi.waitFor(() => {});
      });

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeDefined();
      });
    });
  });

  describe("Acceptance: État synchronisé avec le flux vocal réel", () => {
    it("transitions through all states during a complete flow", async () => {
      render(<Home />);

      // Initially idle — no indicators
      expect(screen.queryByTestId("progress-indicators")).toBeNull();

      // Start recording → capture active
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });
      expect(screen.getByTestId("step-capture")).toHaveAttribute("data-active", "true");

      // Set up fetch for full flow
      let fetchCallCount = 0;
      vi.stubGlobal("fetch", vi.fn(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ text: "Bonjour" }),
          });
        }
        if (fetchCallCount === 2) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ reply: "Bienvenue" }),
          });
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        });
      }));

      // Stop recording → triggers full flow
      await act(async () => {
        fireEvent.click(screen.getByText(/Arreter/));
      });
      await act(async () => {
        await vi.waitFor(() => {});
      });

      // Wait for playing state (end of flow)
      await waitFor(() => {
        expect(screen.getByTestId("step-playing")).toHaveAttribute("data-active", "true");
      });

      // Simulate audio playback ending
      await act(async () => {
        mockSourceOnended?.();
      });

      // Back to idle — indicators hidden
      await waitFor(() => {
        expect(screen.queryByTestId("progress-indicators")).toBeNull();
      });
    });
  });
});
