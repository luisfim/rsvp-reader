import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_WPM,
  MIN_WPM,
  WPM_STEP,
} from "../config/reader";
import { useRsvpPlayer } from "./useRsvpPlayer";

afterEach(() => {
  vi.useRealTimers();
});

describe("useRsvpPlayer", () => {
  it("loads a document and clamps its saved position and speed", () => {
    const { result } = renderHook(() =>
      useRsvpPlayer({ isActive: true }),
    );

    act(() => {
      result.current.loadReaderState("  Example  ", "one two three", {
        documentId: "document-1",
        startIndex: 99,
        savedWordsPerMinute: 9999,
      });
    });

    expect(result.current.documentTitle).toBe("Example");
    expect(result.current.words).toEqual(["one", "two", "three"]);
    expect(result.current.currentWordIndex).toBe(2);
    expect(result.current.wordsPerMinute).toBe(MAX_WPM);
    expect(result.current.activeDocumentId).toBe("document-1");
  });

  it("rejects empty text without replacing the current document", () => {
    const { result } = renderHook(() =>
      useRsvpPlayer({ isActive: true }),
    );

    let response: ReturnType<typeof result.current.loadReaderState>;

    act(() => {
      response = result.current.loadReaderState("Empty", "   ");
    });

    expect(response!).toEqual({
      success: false,
      error: "Paste some text before starting.",
    });
    expect(result.current.words).toEqual([]);
  });

  it("moves manually and keeps indices inside the document", () => {
    const { result } = renderHook(() =>
      useRsvpPlayer({ isActive: true }),
    );

    act(() => {
      result.current.loadReaderState("Example", "one two three");
      result.current.previousWord();
    });

    expect(result.current.currentWordIndex).toBe(0);

    act(() => {
      result.current.nextWord();
      result.current.nextWord();
      result.current.nextWord();
    });

    expect(result.current.currentWordIndex).toBe(2);

    act(() => {
      result.current.seekToWord(-50);
    });

    expect(result.current.currentWordIndex).toBe(0);
  });

  it("changes speed by 25 WPM and respects both limits", () => {
    const { result } = renderHook(() =>
      useRsvpPlayer({ isActive: true }),
    );

    act(() => {
      result.current.loadReaderState("Example", "one two", {
        savedWordsPerMinute: MIN_WPM,
      });
      result.current.decreaseSpeed();
    });

    expect(result.current.wordsPerMinute).toBe(MIN_WPM);

    act(() => {
      result.current.increaseSpeed();
    });

    expect(result.current.wordsPerMinute).toBe(MIN_WPM + WPM_STEP);
  });

  it("advances automatically and pauses on the final word", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useRsvpPlayer({ isActive: true }),
    );

    act(() => {
      result.current.loadReaderState("Example", "one two");
    });

    act(() => {
      result.current.togglePlayback();
    });

    expect(result.current.isPlaying).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.currentWordIndex).toBe(1);
    expect(result.current.isPlaying).toBe(false);
  });
});
