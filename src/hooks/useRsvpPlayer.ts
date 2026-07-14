import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  DEFAULT_FONT_SIZE,
  DEFAULT_WPM,
  FONT_SIZE_STEP,
  MAX_FONT_SIZE,
  MAX_WPM,
  MIN_FONT_SIZE,
  MIN_WPM,
  WPM_STEP,
} from "../config/reader";
import { getWordDelay, tokenizeText } from "../lib/reader";
import type {
  ReaderOptions,
  ReaderSnapshot,
} from "../types/reader";

interface UseRsvpPlayerOptions {
  isActive: boolean;
}

interface LoadReaderResult {
  success: boolean;
  error?: string;
}

export function useRsvpPlayer({
  isActive,
}: UseRsvpPlayerOptions) {
  const [documentTitle, setDocumentTitle] = useState("");
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wordsPerMinute, setWordsPerMinute] = useState(DEFAULT_WPM);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [useNaturalPauses, setUseNaturalPauses] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<
    string | null
  >(null);

  const snapshotRef = useRef<ReaderSnapshot>({
    activeDocumentId: null,
    currentWordIndex: 0,
    wordsPerMinute: DEFAULT_WPM,
    fontSize: DEFAULT_FONT_SIZE,
    useNaturalPauses: false,
  });

  useEffect(() => {
    snapshotRef.current = {
      activeDocumentId,
      currentWordIndex,
      wordsPerMinute,
      fontSize,
      useNaturalPauses,
    };
  }, [
    activeDocumentId,
    currentWordIndex,
    fontSize,
    useNaturalPauses,
    wordsPerMinute,
  ]);

  const loadReaderState = useCallback(
    (
      title: string,
      text: string,
      options: ReaderOptions = {},
    ): LoadReaderResult => {
      const parsedWords = tokenizeText(text);

      if (parsedWords.length === 0) {
        return {
          success: false,
          error: "Paste some text before starting.",
        };
      }

      const requestedIndex = options.startIndex ?? 0;
      const safeIndex = Math.min(
        Math.max(requestedIndex, 0),
        parsedWords.length - 1,
      );

      const savedWpm = options.savedWordsPerMinute ?? DEFAULT_WPM;

      setWords(parsedWords);
      setDocumentTitle(title.trim() || "Untitled text");
      setCurrentWordIndex(safeIndex);
      setWordsPerMinute(
        Math.min(Math.max(savedWpm, MIN_WPM), MAX_WPM),
      );
      setFontSize(options.savedFontSize ?? DEFAULT_FONT_SIZE);
      setUseNaturalPauses(options.savedNaturalPauses ?? false);
      setActiveDocumentId(options.documentId ?? null);
      setIsPlaying(false);

      return { success: true };
    },
    [],
  );

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const clearActiveDocument = useCallback(() => {
    setActiveDocumentId(null);
  }, []);

  const renameActiveDocument = useCallback((title: string) => {
    setDocumentTitle(title);
  }, []);

  const togglePlayback = useCallback(() => {
    if (words.length === 0) {
      return;
    }

    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    if (currentWordIndex >= words.length - 1) {
      setCurrentWordIndex(0);
    }

    setIsPlaying(true);
  }, [currentWordIndex, isPlaying, words.length]);

  const previousWord = useCallback(() => {
    setIsPlaying(false);
    setCurrentWordIndex((currentIndex) =>
      Math.max(0, currentIndex - 1),
    );
  }, []);

  const nextWord = useCallback(() => {
    setIsPlaying(false);
    setCurrentWordIndex((currentIndex) =>
      Math.min(words.length - 1, currentIndex + 1),
    );
  }, [words.length]);

  const seekToWord = useCallback(
    (requestedIndex: number) => {
      if (words.length === 0) {
        return;
      }

      const safeIndex = Math.min(
        Math.max(Math.round(requestedIndex), 0),
        words.length - 1,
      );

      setIsPlaying(false);
      setCurrentWordIndex(safeIndex);
    },
    [words.length],
  );

  const restartReading = useCallback(() => {
    if (words.length === 0) {
      return;
    }

    setCurrentWordIndex(0);
    setIsPlaying(true);
  }, [words.length]);

  const increaseSpeed = useCallback(() => {
    setWordsPerMinute((currentWpm) =>
      Math.min(MAX_WPM, currentWpm + WPM_STEP),
    );
  }, []);

  const decreaseSpeed = useCallback(() => {
    setWordsPerMinute((currentWpm) =>
      Math.max(MIN_WPM, currentWpm - WPM_STEP),
    );
  }, []);

  const increaseFontSize = useCallback(() => {
    setFontSize((currentSize) =>
      Math.min(MAX_FONT_SIZE, currentSize + FONT_SIZE_STEP),
    );
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSize((currentSize) =>
      Math.max(MIN_FONT_SIZE, currentSize - FONT_SIZE_STEP),
    );
  }, []);

  const toggleNaturalPauses = useCallback(() => {
    setUseNaturalPauses((currentValue) => !currentValue);
  }, []);

  const getSnapshot = useCallback((): ReaderSnapshot => {
    return snapshotRef.current;
  }, []);

  useEffect(() => {
    if (!isActive || !isPlaying || words.length === 0) {
      return;
    }

    if (currentWordIndex >= words.length - 1) {
      setIsPlaying(false);
      return;
    }

    const delayInMilliseconds = getWordDelay(
      words[currentWordIndex] ?? "",
      wordsPerMinute,
      useNaturalPauses,
    );

    const timer = window.setTimeout(() => {
      const nextIndex = currentWordIndex + 1;

      setCurrentWordIndex(
        Math.min(nextIndex, words.length - 1),
      );

      if (nextIndex >= words.length - 1) {
        setIsPlaying(false);
      }
    }, Math.max(20, delayInMilliseconds));

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentWordIndex,
    isActive,
    isPlaying,
    useNaturalPauses,
    words,
    wordsPerMinute,
  ]);

  return {
    documentTitle,
    words,
    currentWordIndex,
    isPlaying,
    wordsPerMinute,
    fontSize,
    useNaturalPauses,
    activeDocumentId,
    loadReaderState,
    pause,
    clearActiveDocument,
    renameActiveDocument,
    togglePlayback,
    previousWord,
    nextWord,
    seekToWord,
    restartReading,
    increaseSpeed,
    decreaseSpeed,
    increaseFontSize,
    decreaseFontSize,
    toggleNaturalPauses,
    getSnapshot,
  };
}
