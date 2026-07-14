import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

const DEFAULT_CONTROLS_HIDE_DELAY_MS = 2200;

interface UseReaderFocusModeOptions {
  isActive: boolean;
  isPlaying: boolean;
  controlsHideDelayMs?: number;
}

interface UseReaderFocusModeResult {
  readerShellRef: RefObject<HTMLDivElement | null>;
  isFocusMode: boolean;
  areReaderControlsVisible: boolean;
  revealReaderControls: () => void;
  toggleFocusMode: () => Promise<void>;
  exitFocusMode: () => Promise<void>;
}

export function useReaderFocusMode({
  isActive,
  isPlaying,
  controlsHideDelayMs = DEFAULT_CONTROLS_HIDE_DELAY_MS,
}: UseReaderFocusModeOptions): UseReaderFocusModeResult {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [areReaderControlsVisible, setAreReaderControlsVisible] =
    useState(true);

  const readerShellRef = useRef<HTMLDivElement | null>(null);
  const controlsHideTimerRef = useRef<number | null>(null);

  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current === null) {
      return;
    }

    window.clearTimeout(controlsHideTimerRef.current);
    controlsHideTimerRef.current = null;
  }, []);

  const exitFocusMode = useCallback(async () => {
    clearControlsHideTimer();
    setIsFocusMode(false);
    setAreReaderControlsVisible(true);

    if (!document.fullscreenElement) {
      return;
    }

    try {
      await document.exitFullscreen();
    } catch {
      // The browser may already be leaving fullscreen.
    }
  }, [clearControlsHideTimer]);

  const toggleFocusMode = useCallback(async () => {
    if (isFocusMode) {
      await exitFocusMode();
      return;
    }

    setIsFocusMode(true);
    setAreReaderControlsVisible(true);

    const readerShell = readerShellRef.current;

    if (!document.fullscreenElement && readerShell?.requestFullscreen) {
      try {
        await readerShell.requestFullscreen();
      } catch {
        // Focus mode remains usable when fullscreen is unavailable or blocked.
      }
    }
  }, [exitFocusMode, isFocusMode]);

  const revealReaderControls = useCallback(() => {
    clearControlsHideTimer();
    setAreReaderControlsVisible(true);

    if (!isActive || !isFocusMode || !isPlaying) {
      return;
    }

    controlsHideTimerRef.current = window.setTimeout(() => {
      setAreReaderControlsVisible(false);
      controlsHideTimerRef.current = null;
    }, controlsHideDelayMs);
  }, [
    clearControlsHideTimer,
    controlsHideDelayMs,
    isActive,
    isFocusMode,
    isPlaying,
  ]);

  useEffect(() => {
    revealReaderControls();

    return clearControlsHideTimer;
  }, [clearControlsHideTimer, revealReaderControls]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        return;
      }

      clearControlsHideTimer();
      setIsFocusMode(false);
      setAreReaderControlsVisible(true);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );
    };
  }, [clearControlsHideTimer]);

  useEffect(() => {
    if (isActive) {
      return;
    }

    clearControlsHideTimer();
    setIsFocusMode(false);
    setAreReaderControlsVisible(true);
  }, [clearControlsHideTimer, isActive]);

  return {
    readerShellRef,
    isFocusMode,
    areReaderControlsVisible,
    revealReaderControls,
    toggleFocusMode,
    exitFocusMode,
  };
}
