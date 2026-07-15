import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { submitBetaFeedback } from "../lib/feedback";
import { FeedbackPage } from "./FeedbackPage";

vi.mock("../lib/feedback", async () => {
  const actual = await vi.importActual<typeof import("../lib/feedback")>(
    "../lib/feedback",
  );

  return {
    ...actual,
    submitBetaFeedback: vi.fn(),
  };
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

function renderFeedbackPage() {
  return render(
    <MemoryRouter>
      <FeedbackPage
        userId={null}
        accountLabel="Sign in"
        cloudConnectionLabel={null}
        cloudConnectionStatus="online"
        isOnline
        libraryMode="local"
        savedDocumentCount={0}
        onNavigateHome={() => undefined}
        onOpenLibrary={() => undefined}
        onOpenAccount={() => undefined}
        onOpenHelp={() => undefined}
      />
    </MemoryRouter>,
  );
}

describe("FeedbackPage", () => {
  it("explains diagnostics and submits a beta report", async () => {
    vi.mocked(submitBetaFeedback).mockResolvedValueOnce({ error: null });
    renderFeedbackPage();

    expect(
      screen.getByRole("heading", { name: "Beta Feedback" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Document text and titles are never included/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Your feedback"), {
      target: {
        value: "The next button was difficult to find on mobile.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "4 out of 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => {
      expect(submitBetaFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 4,
          message: "The next button was difficult to find on mobile.",
          includeDiagnostics: true,
        }),
        expect.objectContaining({
          userId: null,
          authenticated: false,
          libraryMode: "local",
        }),
      );
    });

    expect(
      await screen.findByText(/added to the beta review queue/i),
    ).toBeInTheDocument();
  });

  it("shows submission errors without clearing the report", async () => {
    vi.mocked(submitBetaFeedback).mockResolvedValueOnce({
      error: "Feedback storage is not ready yet.",
    });
    renderFeedbackPage();

    const messageField = screen.getByLabelText("Your feedback");
    fireEvent.change(messageField, {
      target: { value: "A reproducible synchronization problem." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Feedback storage is not ready yet.");
    expect(messageField).toHaveValue(
      "A reproducible synchronization problem.",
    );
  });
});
