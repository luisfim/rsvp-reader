import { fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useReaderKeyboardControls } from "./useReaderKeyboardControls";

function createControls(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    wordCount: 10,
    isFocusMode: false,
    onRevealControls: vi.fn(),
    onTogglePlayback: vi.fn(),
    onPreviousWord: vi.fn(),
    onNextWord: vi.fn(),
    onIncreaseSpeed: vi.fn(),
    onDecreaseSpeed: vi.fn(),
    onToggleFocusMode: vi.fn(),
    onExitFocusMode: vi.fn(),
    onSeekToWord: vi.fn(),
    onExitReader: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: null,
  });
});

describe("useReaderKeyboardControls", () => {
  it("toggles playback with Space and reveals the controls", () => {
    const controls = createControls();

    renderHook(() => useReaderKeyboardControls(controls));
    fireEvent.keyDown(window, { code: "Space" });

    expect(controls.onRevealControls).toHaveBeenCalledTimes(1);
    expect(controls.onTogglePlayback).toHaveBeenCalledTimes(1);
  });

  it("maps WASD and arrow keys to navigation and speed", () => {
    const controls = createControls();

    renderHook(() => useReaderKeyboardControls(controls));

    fireEvent.keyDown(window, { code: "KeyA" });
    fireEvent.keyDown(window, { code: "ArrowRight" });
    fireEvent.keyDown(window, { code: "KeyW" });
    fireEvent.keyDown(window, { code: "ArrowDown" });

    expect(controls.onPreviousWord).toHaveBeenCalledTimes(1);
    expect(controls.onNextWord).toHaveBeenCalledTimes(1);
    expect(controls.onIncreaseSpeed).toHaveBeenCalledTimes(1);
    expect(controls.onDecreaseSpeed).toHaveBeenCalledTimes(1);
  });

  it("jumps to the beginning and end of the document", () => {
    const controls = createControls({ wordCount: 42 });

    renderHook(() => useReaderKeyboardControls(controls));

    fireEvent.keyDown(window, { code: "Home" });
    fireEvent.keyDown(window, { code: "End" });

    expect(controls.onSeekToWord).toHaveBeenNthCalledWith(1, 0);
    expect(controls.onSeekToWord).toHaveBeenNthCalledWith(2, 41);
  });

  it("does not capture keys while the user is typing", () => {
    const controls = createControls();
    const input = document.createElement("input");
    document.body.appendChild(input);

    renderHook(() => useReaderKeyboardControls(controls));
    fireEvent.keyDown(input, { code: "Space" });

    expect(controls.onRevealControls).not.toHaveBeenCalled();
    expect(controls.onTogglePlayback).not.toHaveBeenCalled();

    input.remove();
  });

  it("uses Escape to leave focus mode before exiting the reader", () => {
    const focusedControls = createControls({ isFocusMode: true });
    const focusedHook = renderHook(() =>
      useReaderKeyboardControls(focusedControls),
    );

    fireEvent.keyDown(window, { code: "Escape" });

    expect(focusedControls.onExitFocusMode).toHaveBeenCalledTimes(1);
    expect(focusedControls.onExitReader).not.toHaveBeenCalled();

    focusedHook.unmount();

    const normalControls = createControls();
    renderHook(() => useReaderKeyboardControls(normalControls));

    fireEvent.keyDown(window, { code: "Escape" });

    expect(normalControls.onExitReader).toHaveBeenCalledTimes(1);
  });
});
