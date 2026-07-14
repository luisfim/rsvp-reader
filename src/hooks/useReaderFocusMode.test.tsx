import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReaderFocusMode } from "./useReaderFocusMode";

beforeEach(() => {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: null,
  });

  Object.defineProperty(document, "exitFullscreen", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useReaderFocusMode", () => {
  it("enters and exits focus mode even without fullscreen support", async () => {
    const { result } = renderHook(() =>
      useReaderFocusMode({ isActive: true, isPlaying: false }),
    );

    await act(async () => {
      await result.current.toggleFocusMode();
    });

    expect(result.current.isFocusMode).toBe(true);

    await act(async () => {
      await result.current.exitFocusMode();
    });

    expect(result.current.isFocusMode).toBe(false);
    expect(result.current.areReaderControlsVisible).toBe(true);
  });

  it("hides controls after the configured delay while focused and playing", async () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ isPlaying }) =>
        useReaderFocusMode({
          isActive: true,
          isPlaying,
          controlsHideDelayMs: 500,
        }),
      { initialProps: { isPlaying: false } },
    );

    await act(async () => {
      await result.current.toggleFocusMode();
    });

    rerender({ isPlaying: true });

    act(() => {
      result.current.revealReaderControls();
      vi.advanceTimersByTime(500);
    });

    expect(result.current.areReaderControlsVisible).toBe(false);
  });

  it("leaves focus mode when fullscreen ends", async () => {
    const { result } = renderHook(() =>
      useReaderFocusMode({ isActive: true, isPlaying: false }),
    );

    await act(async () => {
      await result.current.toggleFocusMode();
    });

    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(result.current.isFocusMode).toBe(false);
    expect(result.current.areReaderControlsVisible).toBe(true);
  });
});
