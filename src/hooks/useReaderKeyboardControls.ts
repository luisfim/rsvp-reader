import { useEffect } from "react";

interface UseReaderKeyboardControlsOptions {
  enabled: boolean;
  wordCount: number;
  isFocusMode: boolean;
  onRevealControls: () => void;
  onTogglePlayback: () => void;
  onPreviousWord: () => void;
  onNextWord: () => void;
  onIncreaseSpeed: () => void;
  onDecreaseSpeed: () => void;
  onToggleFocusMode: () => void | Promise<void>;
  onOpenHelp: () => void;
  onExitFocusMode: () => void | Promise<void>;
  onSeekToWord: (index: number) => void;
  onExitReader: () => void;
}

function isTextEntryElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

function isNativeButtonActivation(
  event: KeyboardEvent,
): boolean {
  return (
    event.target instanceof HTMLButtonElement &&
    (event.code === "Space" || event.code === "Enter")
  );
}

export function useReaderKeyboardControls({
  enabled,
  wordCount,
  isFocusMode,
  onRevealControls,
  onTogglePlayback,
  onPreviousWord,
  onNextWord,
  onIncreaseSpeed,
  onDecreaseSpeed,
  onToggleFocusMode,
  onOpenHelp,
  onExitFocusMode,
  onSeekToWord,
  onExitReader,
}: UseReaderKeyboardControlsOptions): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        isTextEntryElement(event.target) ||
        isNativeButtonActivation(event)
      ) {
        return;
      }

      const controlledKeys = new Set([
        "Space",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "KeyA",
        "KeyD",
        "KeyW",
        "KeyS",
        "KeyF",
        "Slash",
        "Home",
        "End",
        "Escape",
      ]);

      if (!controlledKeys.has(event.code)) {
        return;
      }

      event.preventDefault();
      onRevealControls();

      switch (event.code) {
        case "Space":
          if (!event.repeat) {
            onTogglePlayback();
          }
          break;

        case "ArrowLeft":
        case "KeyA":
          onPreviousWord();
          break;

        case "ArrowRight":
        case "KeyD":
          onNextWord();
          break;

        case "ArrowUp":
        case "KeyW":
          onIncreaseSpeed();
          break;

        case "ArrowDown":
        case "KeyS":
          onDecreaseSpeed();
          break;

        case "KeyF":
          if (!event.repeat) {
            void onToggleFocusMode();
          }
          break;

        case "Slash":
          if (event.key === "?" && !event.repeat) {
            onOpenHelp();
          }
          break;

        case "Home":
          onSeekToWord(0);
          break;

        case "End":
          onSeekToWord(Math.max(0, wordCount - 1));
          break;

        case "Escape":
          if (isFocusMode || document.fullscreenElement) {
            void onExitFocusMode();
          } else {
            onExitReader();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    enabled,
    isFocusMode,
    onDecreaseSpeed,
    onExitFocusMode,
    onExitReader,
    onIncreaseSpeed,
    onNextWord,
    onOpenHelp,
    onPreviousWord,
    onRevealControls,
    onSeekToWord,
    onToggleFocusMode,
    onTogglePlayback,
    wordCount,
  ]);
}
