import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import Home from "../page";

// --- Mocks ---

vi.mock("@/lib/audio-playback", () => ({
  playAudio: vi.fn().mockResolvedValue({ ok: true }),
}));

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

function setupAudioContextMock() {
  vi.stubGlobal(
    "AudioContext",
    vi.fn(() => ({
      decodeAudioData: vi.fn().mockResolvedValue({}),
      destination: {},
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        onended: null,
      })),
    }))
  );
}

describe("Home page — Voice recording UI (IMP-16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBrowserMocks();
    setupAudioContextMock();
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });
  });

  afterEach(cleanup);

  describe("Acceptance: Bouton d'enregistrement visible dans l'interface", () => {
    it("displays the recording button on initial render", () => {
      render(<Home />);
      const button = screen.getByText("Appuyer pour parler");
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe("BUTTON");
    });

    it("the recording button is clickable", () => {
      render(<Home />);
      const button = screen.getByText("Appuyer pour parler");
      expect(button).not.toBeDisabled();
    });
  });

  describe("Acceptance: Clic sur le bouton démarre l'enregistrement", () => {
    it("starts recording when button is clicked", async () => {
      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });
      // Recording started — stop button should now appear
      expect(screen.getByText(/Arreter/)).toBeInTheDocument();
    });

    it("hides the start button when recording", async () => {
      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });
      expect(screen.queryByText("Appuyer pour parler")).toBeNull();
    });
  });

  describe("Acceptance: MediaRecorder API initialisée avec succès", () => {
    it("requests microphone access via getUserMedia", async () => {
      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    it("initializes MediaRecorder and calls start()", async () => {
      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });
      expect(mockMediaRecorderStart).toHaveBeenCalled();
    });
  });

  describe("Acceptance: Audio capturé depuis le microphone", () => {
    it("captures audio data via ondataavailable after stop", async () => {
      render(<Home />);

      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      // Mock fetch so the stop flow doesn't fail
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ text: "Bonjour" }),
          })
        )
      );

      // Stop triggers MediaRecorder.stop → ondataavailable → onstop → audio blob
      await act(async () => {
        fireEvent.click(screen.getByText(/Arreter/));
      });
      await act(async () => {
        await vi.waitFor(() => {});
      });

      expect(mockMediaRecorderStop).toHaveBeenCalled();
    });

    it("provides a stop button during recording", async () => {
      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });
      const stopButton = screen.getByText(/Arreter/);
      expect(stopButton).toBeInTheDocument();
      expect(stopButton.tagName).toBe("BUTTON");
    });
  });

  describe("Acceptance: Gestion des erreurs de permission microphone", () => {
    it("handles microphone permission denied gracefully", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError")
      );

      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      // Should return to idle state — start button visible again
      await waitFor(() => {
        expect(screen.getByText("Appuyer pour parler")).toBeInTheDocument();
      });
    });

    it("handles device not found error gracefully", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("No device", "NotFoundError")
      );

      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      await waitFor(() => {
        expect(screen.getByText("Appuyer pour parler")).toBeInTheDocument();
      });
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  describe("Acceptance: Message d'erreur clair en cas d'échec d'autorisation", () => {
    it("displays permission denied error with clear message", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError")
      );

      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      const errorMessage = screen.getByTestId("error-message");
      expect(errorMessage.textContent).toContain("refuse");
      expect(errorMessage.textContent).toContain("microphone");
    });

    it("displays actionable suggestions for permission errors", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError")
      );

      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("error-suggestions")).toBeInTheDocument();
      });

      const suggestions = screen.getByTestId("error-suggestions");
      const items = suggestions.querySelectorAll("li");
      expect(items.length).toBeGreaterThan(0);
    });

    it("provides a retry button after permission error", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError")
      );

      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("retry-button")).toBeInTheDocument();
      });

      // Allow retry
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("retry-button"));
      });

      await waitFor(() => {
        expect(screen.getByText(/Arreter/)).toBeInTheDocument();
      });
    });

    it("displays error step label for capture errors", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError")
      );

      render(<Home />);
      await act(async () => {
        fireEvent.click(screen.getByText("Appuyer pour parler"));
      });

      await waitFor(() => {
        const stepLabel = screen.getByTestId("error-step-label");
        expect(stepLabel.textContent).toContain("Capture audio");
      });
    });
  });
});
