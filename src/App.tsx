import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createSavedDocument,
  loadSavedDocuments,
  persistSavedDocuments,
  type SavedDocument,
} from "./lib/library";

import { extractTextFromPdf } from "./lib/pdf";
import "./App.css";

const DEMO_TEXT = `
Rapid Serial Visual Presentation is a reading method in which words are
shown one at a time in the same position. By keeping the eyes focused on a
single point, the reader can move through a text without constantly shifting
attention across the page. This version demonstrates the core reading
experience. Users can paste their own text, upload PDF documents, save
readings locally and continue from exactly where they stopped.
`;

const MIN_WPM = 250;
const MAX_WPM = 2000;
const WPM_STEP = 25;
const DEFAULT_WPM = 400;

const MIN_FONT_SIZE = 48;
const MAX_FONT_SIZE = 112;
const FONT_SIZE_STEP = 8;
const DEFAULT_FONT_SIZE = 72;

const MAX_PDF_FILE_SIZE = 20 * 1024 * 1024;
const AUTO_SAVE_INTERVAL_MS = 1000;

type Screen = "home" | "reader";

interface ReaderOptions {
  documentId?: string | null;
  startIndex?: number;
  savedWordsPerMinute?: number;
  savedFontSize?: number;
  savedNaturalPauses?: boolean;
}

interface ReaderSnapshot {
  activeDocumentId: string | null;
  currentWordIndex: number;
  wordsPerMinute: number;
  fontSize: number;
  useNaturalPauses: boolean;
}

function tokenizeText(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function getFocusLetterIndex(word: string): number {
  const cleanWord = word.replace(
    /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
    "",
  );

  if (!cleanWord) {
    return Math.max(0, Math.floor((word.length - 1) / 2));
  }

  const cleanWordStart = word.indexOf(cleanWord);
  let focusPosition: number;

  if (cleanWord.length <= 1) {
    focusPosition = 0;
  } else if (cleanWord.length <= 5) {
    focusPosition = 1;
  } else if (cleanWord.length <= 9) {
    focusPosition = 2;
  } else if (cleanWord.length <= 13) {
    focusPosition = 3;
  } else {
    focusPosition = 4;
  }

  return cleanWordStart + Math.min(focusPosition, cleanWord.length - 1);
}

function getWordDelay(
  word: string,
  wordsPerMinute: number,
  useNaturalPauses: boolean,
): number {
  const baseDelay = 60_000 / wordsPerMinute;

  if (!useNaturalPauses) {
    return baseDelay;
  }

  let multiplier = 1;

  const cleanWord = word.replace(
    /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
    "",
  );

  const wordLength = Array.from(cleanWord).length;

  if (wordLength >= 13) {
    multiplier += 0.45;
  } else if (wordLength >= 9) {
    multiplier += 0.25;
  }

  if (/[.!?]["')\]]?$/.test(word)) {
    multiplier += 1.1;
  } else if (/[,;:]["')\]]?$/.test(word)) {
    multiplier += 0.45;
  }

  return baseDelay * multiplier;
}

function App() {
  const [screen, setScreen] = useState<Screen>("home");

  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [formError, setFormError] = useState("");

  const [pdfFileName, setPdfFileName] = useState("");
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  const [documentTitle, setDocumentTitle] = useState("");
  const [words, setWords] = useState<string[]>([]);

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wordsPerMinute, setWordsPerMinute] = useState(DEFAULT_WPM);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [useNaturalPauses, setUseNaturalPauses] = useState(false);

  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>(
    () => loadSavedDocuments(),
  );

  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(
    null,
  );

  const [libraryError, setLibraryError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const librarySectionRef = useRef<HTMLElement | null>(null);
  const documentLayerRef = useRef<HTMLDivElement | null>(null);
  const activeBackgroundWordRef = useRef<HTMLSpanElement | null>(null);
  const lastBackgroundLineTopRef = useRef<number | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutoSaveAtRef = useRef(0);
  const savedDocumentsRef = useRef<SavedDocument[]>(savedDocuments);

  const readerSnapshotRef = useRef<ReaderSnapshot>({
    activeDocumentId: null,
    currentWordIndex: 0,
    wordsPerMinute: DEFAULT_WPM,
    fontSize: DEFAULT_FONT_SIZE,
    useNaturalPauses: false,
  });

  const pastedWordCount = useMemo(
    () => tokenizeText(draftText).length,
    [draftText],
  );

  const latestDocument = useMemo(() => {
    if (savedDocuments.length === 0) {
      return null;
    }

    return savedDocuments.reduce((latest, document) =>
      new Date(document.updatedAt).getTime() >
      new Date(latest.updatedAt).getTime()
        ? document
        : latest,
    );
  }, [savedDocuments]);

  const latestDocumentProgress = latestDocument
    ? latestDocument.wordCount <= 1
      ? 0
      : (latestDocument.currentWordIndex /
          (latestDocument.wordCount - 1)) *
        100
    : 0;

  const latestDocumentProgressLabel =
    latestDocumentProgress > 0 && latestDocumentProgress < 1
      ? "<1"
      : Math.round(latestDocumentProgress).toString();

  const currentWord = words[currentWordIndex] ?? "";
  const focusLetterIndex = getFocusLetterIndex(currentWord);

  const wordBeforeFocus = currentWord.slice(0, focusLetterIndex);
  const focusLetter = currentWord[focusLetterIndex] ?? "";
  const wordAfterFocus = currentWord.slice(focusLetterIndex + 1);

  const progress =
    words.length <= 1
      ? words.length === 1
        ? 100
        : 0
      : (currentWordIndex / (words.length - 1)) * 100;

  const remainingWords = Math.max(words.length - currentWordIndex, 0);

  const estimatedMinutes =
    remainingWords > 0
      ? Math.max(1, Math.ceil(remainingWords / wordsPerMinute))
      : 0;

  useEffect(() => {
    readerSnapshotRef.current = {
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

  useEffect(() => {
    savedDocumentsRef.current = savedDocuments;

    try {
      persistSavedDocuments(savedDocuments);
      setLibraryError("");
    } catch {
      setLibraryError(
        "The document could not be saved. Browser storage may be full.",
      );
    }
  }, [savedDocuments]);

  const openReader = useCallback(
    (
      title: string,
      text: string,
      options: ReaderOptions = {},
    ) => {
      const parsedWords = tokenizeText(text);

      if (parsedWords.length === 0) {
        setFormError("Paste some text before starting.");
        return;
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
      setWordsPerMinute(Math.min(Math.max(savedWpm, MIN_WPM), MAX_WPM));
      setFontSize(options.savedFontSize ?? DEFAULT_FONT_SIZE);
      setUseNaturalPauses(options.savedNaturalPauses ?? false);
      setActiveDocumentId(options.documentId ?? null);
      setIsPlaying(false);
      setFormError("");
      setScreen("reader");
      setLastSavedAt(options.documentId ? Date.now() : null);

      lastBackgroundLineTopRef.current = null;
      lastAutoSaveAtRef.current = 0;
    },
    [],
  );

  const startPastedText = () => {
    const parsedWords = tokenizeText(draftText);

    if (parsedWords.length === 0) {
      setFormError("Paste some text before starting.");
      return;
    }

    const title = draftTitle.trim() || "Untitled text";

    const newDocument = createSavedDocument({
      title,
      text: draftText,
      wordCount: parsedWords.length,
      wordsPerMinute: DEFAULT_WPM,
      fontSize: DEFAULT_FONT_SIZE,
      useNaturalPauses: false,
    });

    setSavedDocuments((currentDocuments) => [
      newDocument,
      ...currentDocuments,
    ]);

    openReader(title, draftText, {
      documentId: newDocument.id,
      startIndex: 0,
      savedWordsPerMinute: newDocument.wordsPerMinute,
      savedFontSize: newDocument.fontSize,
      savedNaturalPauses: newDocument.useNaturalPauses,
    });
  };

  const startDemo = () => {
    openReader("RSVP demonstration", DEMO_TEXT);
  };

  const scrollToLibrary = useCallback(() => {
    librarySectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const handlePdfUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setFormError("Choose a valid PDF file.");
      setPdfFileName("");
      return;
    }

    if (file.size > MAX_PDF_FILE_SIZE) {
      setFormError("Choose a PDF smaller than 20 MB.");
      setPdfFileName("");
      return;
    }

    setIsExtractingPdf(true);
    setPdfProgress(0);
    setPdfFileName(file.name);
    setFormError("");

    try {
      const extractedText = await extractTextFromPdf(
        file,
        (currentPage, totalPages) => {
          setPdfProgress(
            Math.round((currentPage / totalPages) * 100),
          );
        },
      );

      const extractedWords = tokenizeText(extractedText);

      if (extractedWords.length === 0) {
        throw new Error(
          "No selectable text was found. This may be a scanned PDF.",
        );
      }

      setDraftText(extractedText);

      setDraftTitle((currentTitle) => {
        if (currentTitle.trim()) {
          return currentTitle;
        }

        return file.name.replace(/\.pdf$/i, "");
      });

      setPdfProgress(100);
      setFormError("");
    } catch (error) {
      setPdfFileName("");
      setPdfProgress(0);
      setFormError(
        error instanceof Error
          ? error.message
          : "The PDF could not be processed.",
      );
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const continueSavedDocument = (savedDocument: SavedDocument) => {
    openReader(savedDocument.title, savedDocument.text, {
      documentId: savedDocument.id,
      startIndex: savedDocument.currentWordIndex,
      savedWordsPerMinute: savedDocument.wordsPerMinute,
      savedFontSize: savedDocument.fontSize,
      savedNaturalPauses: savedDocument.useNaturalPauses,
    });
  };

  const restartSavedDocument = (savedDocument: SavedDocument) => {
    const updatedAt = new Date().toISOString();

    setSavedDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === savedDocument.id
          ? {
              ...document,
              currentWordIndex: 0,
              updatedAt,
            }
          : document,
      ),
    );

    openReader(savedDocument.title, savedDocument.text, {
      documentId: savedDocument.id,
      startIndex: 0,
      savedWordsPerMinute: savedDocument.wordsPerMinute,
      savedFontSize: savedDocument.fontSize,
      savedNaturalPauses: savedDocument.useNaturalPauses,
    });
  };

  const deleteSavedDocument = (savedDocument: SavedDocument) => {
    const shouldDelete = window.confirm(
      `Delete "${savedDocument.title}" from your library?`,
    );

    if (!shouldDelete) {
      return;
    }

    setSavedDocuments((currentDocuments) =>
      currentDocuments.filter(
        (document) => document.id !== savedDocument.id,
      ),
    );
  };

  const saveActiveProgress = useCallback(() => {
    if (!activeDocumentId) {
      return;
    }

    const updatedAt = new Date().toISOString();

    setSavedDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === activeDocumentId
          ? {
              ...document,
              currentWordIndex,
              wordsPerMinute,
              fontSize,
              useNaturalPauses,
              updatedAt,
            }
          : document,
      ),
    );

    setLastSavedAt(Date.now());
  }, [
    activeDocumentId,
    currentWordIndex,
    fontSize,
    useNaturalPauses,
    wordsPerMinute,
  ]);

  const persistCurrentSnapshot = useCallback(() => {
    const snapshot = readerSnapshotRef.current;

    if (!snapshot.activeDocumentId) {
      return;
    }

    const updatedAt = new Date().toISOString();

    const updatedDocuments = savedDocumentsRef.current.map((document) =>
      document.id === snapshot.activeDocumentId
        ? {
            ...document,
            currentWordIndex: snapshot.currentWordIndex,
            wordsPerMinute: snapshot.wordsPerMinute,
            fontSize: snapshot.fontSize,
            useNaturalPauses: snapshot.useNaturalPauses,
            updatedAt,
          }
        : document,
    );

    try {
      persistSavedDocuments(updatedDocuments);
      savedDocumentsRef.current = updatedDocuments;
    } catch {
      // A pagehide event has no reliable place to display an error.
    }
  }, []);

  const returnHome = useCallback(() => {
    saveActiveProgress();
    persistCurrentSnapshot();
    setIsPlaying(false);
    setActiveDocumentId(null);
    setScreen("home");
  }, [persistCurrentSnapshot, saveActiveProgress]);

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

  useEffect(() => {
    if (
      screen !== "reader" ||
      !isPlaying ||
      words.length === 0
    ) {
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
    isPlaying,
    screen,
    useNaturalPauses,
    words,
    wordsPerMinute,
  ]);

  useEffect(() => {
    if (screen !== "reader" || !activeDocumentId) {
      return;
    }

    const now = Date.now();

    const shouldSave =
      !isPlaying ||
      currentWordIndex >= words.length - 1 ||
      now - lastAutoSaveAtRef.current >= AUTO_SAVE_INTERVAL_MS;

    if (!shouldSave) {
      return;
    }

    lastAutoSaveAtRef.current = now;
    saveActiveProgress();
  }, [
    activeDocumentId,
    currentWordIndex,
    isPlaying,
    saveActiveProgress,
    screen,
    words.length,
  ]);

  useEffect(() => {
    const handlePageHide = () => {
      persistCurrentSnapshot();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistCurrentSnapshot();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [persistCurrentSnapshot]);

  useEffect(() => {
    if (screen !== "reader") {
      return;
    }

    const documentLayer = documentLayerRef.current;
    const activeWord = activeBackgroundWordRef.current;

    if (!documentLayer || !activeWord) {
      return;
    }

    const layerRect = documentLayer.getBoundingClientRect();
    const wordRect = activeWord.getBoundingClientRect();

    const lineTop = Math.max(
      0,
      Math.round(
        documentLayer.scrollTop +
          wordRect.top -
          layerRect.top -
          28,
      ),
    );

    const previousLineTop = lastBackgroundLineTopRef.current;

    if (
      previousLineTop !== null &&
      Math.abs(previousLineTop - lineTop) < 2
    ) {
      return;
    }

    lastBackgroundLineTopRef.current = lineTop;

    documentLayer.scrollTo({
      top: lineTop,
      behavior: isPlaying ? "auto" : "smooth",
    });
  }, [currentWordIndex, isPlaying, screen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (screen !== "reader") {
        return;
      }

      const target = event.target as HTMLElement;

      const userIsTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (userIsTyping) {
        return;
      }

      const isNativeButtonActivation =
        target instanceof HTMLButtonElement &&
        (event.code === "Space" || event.code === "Enter");

      if (isNativeButtonActivation) {
        return;
      }

      const controlledKeys = [
        "Space",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "KeyA",
        "KeyD",
        "KeyW",
        "KeyS",
        "Escape",
      ];

      if (controlledKeys.includes(event.code)) {
        event.preventDefault();
      }

      switch (event.code) {
        case "Space":
          if (!event.repeat) {
            togglePlayback();
          }
          break;

        case "ArrowLeft":
        case "KeyA":
          previousWord();
          break;

        case "ArrowRight":
        case "KeyD":
          nextWord();
          break;

        case "ArrowUp":
        case "KeyW":
          increaseSpeed();
          break;

        case "ArrowDown":
        case "KeyS":
          decreaseSpeed();
          break;

        case "Escape":
          returnHome();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    decreaseSpeed,
    increaseSpeed,
    nextWord,
    previousWord,
    returnHome,
    screen,
    togglePlayback,
  ]);

  if (screen === "home") {
    return (
      <div className="landing-shell">
        <header className="site-header">
          <button
            className="brand brand-button"
            type="button"
            aria-label="RSVP Reader home"
          >
            <span className="brand-mark" />
            RSVP Reader
          </button>

          <div className="header-actions">
            <button
              className="library-nav-button"
              type="button"
              onClick={scrollToLibrary}
              aria-controls="local-library"
            >
              Library
              <span className="library-nav-count">
                {savedDocuments.length}
              </span>
            </button>

            <button
              className="sign-in-button"
              type="button"
              title="Account support will be added later"
            >
              Sign in
            </button>
          </div>
        </header>

        <main className="landing-main">
          <section className="hero-section">
            <div className="hero-copy">
              <span className="eyebrow">
                Read without losing focus
              </span>

              <h1>
                Your text.
                <br />
                One word at a time.
              </h1>

              <p className="hero-description">
                Transform books, articles and documents into a focused
                speed-reading experience using Rapid Serial Visual
                Presentation.
              </p>

              <div className="hero-features">
                <span>250–2,000 WPM</span>
                <span>Keyboard controls</span>
                <span>Local reading library</span>
              </div>

              <button
                className="demo-button"
                type="button"
                onClick={startDemo}
              >
                Try the demonstration
                <span aria-hidden="true">→</span>
              </button>

              {latestDocument && (
                <section
                  className="continue-reading-card"
                  aria-label="Continue your latest reading"
                >
                  <div className="continue-reading-heading">
                    <div>
                      <span className="continue-reading-label">
                        Continue reading
                      </span>

                      <h2>{latestDocument.title}</h2>
                    </div>

                    <span className="continue-reading-percentage">
                      {latestDocumentProgressLabel}%
                    </span>
                  </div>

                  <p>
                    Word{" "}
                    {Math.min(
                      latestDocument.currentWordIndex + 1,
                      latestDocument.wordCount,
                    ).toLocaleString("en-US")}{" "}
                    of{" "}
                    {latestDocument.wordCount.toLocaleString(
                      "en-US",
                    )}
                  </p>

                  <div
                    className="continue-reading-progress"
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        width: `${latestDocumentProgress}%`,
                      }}
                    />
                  </div>

                  <div className="continue-reading-actions">
                    <button
                      className="continue-latest-button"
                      type="button"
                      onClick={() =>
                        continueSavedDocument(latestDocument)
                      }
                    >
                      Continue
                      <span aria-hidden="true">→</span>
                    </button>

                    <button
                      className="view-library-button"
                      type="button"
                      onClick={scrollToLibrary}
                    >
                      View all saved texts
                    </button>
                  </div>
                </section>
              )}
            </div>

            <section className="text-entry-card">
              <div className="entry-card-header">
                <div>
                  <span className="entry-step">New reading</span>
                  <h2>Paste your text</h2>
                </div>

                <span className="word-count">
                  {pastedWordCount.toLocaleString("en-US")} words
                </span>
              </div>

              <label className="field-label" htmlFor="document-title">
                Title
              </label>

              <input
                id="document-title"
                className="title-input"
                type="text"
                value={draftTitle}
                onChange={(event) => {
                  setDraftTitle(event.target.value);
                  setFormError("");
                }}
                placeholder="Optional document title"
                maxLength={120}
              />

              <label className="field-label" htmlFor="document-text">
                Text
              </label>

              <textarea
                id="document-text"
                className="text-input"
                value={draftText}
                onChange={(event) => {
                  setDraftText(event.target.value);
                  setFormError("");
                }}
                placeholder="Paste a chapter, article or any other text here..."
                spellCheck
              />

              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}

              <button
                className="start-reading-button"
                type="button"
                onClick={startPastedText}
                disabled={pastedWordCount === 0}
              >
                Start reading
                <span aria-hidden="true">→</span>
              </button>

              <input
                ref={pdfInputRef}
                className="visually-hidden"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfUpload}
                disabled={isExtractingPdf}
                aria-label="Upload a PDF document"
              />

              <button
                className="pdf-upload-button"
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={isExtractingPdf}
              >
                <div className="pdf-upload-icon">PDF</div>

                <div className="pdf-upload-copy">
                  <strong>
                    {isExtractingPdf
                      ? "Extracting text..."
                      : pdfFileName || "Upload a PDF"}
                  </strong>

                  <span>
                    {isExtractingPdf
                      ? `Reading document — ${pdfProgress}%`
                      : pdfFileName
                        ? `${pastedWordCount.toLocaleString(
                            "en-US",
                          )} words ready`
                        : "Choose a text-based PDF up to 20 MB."}
                  </span>

                  {isExtractingPdf && (
                    <div
                      className="pdf-mini-progress"
                      aria-hidden="true"
                    >
                      <span
                        style={{
                          width: `${pdfProgress}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                <span className="upload-action">
                  {isExtractingPdf
                    ? `${pdfProgress}%`
                    : pdfFileName
                      ? "Replace"
                      : "Choose file"}
                </span>
              </button>
            </section>
          </section>

          <section
            ref={librarySectionRef}
            id="local-library"
            className="library-section"
            aria-labelledby="library-heading"
          >
            <div className="library-header">
              <div>
                <span className="eyebrow">
                  Saved locally on this device
                </span>

                <h2 id="library-heading">Local library</h2>
              </div>

              <span className="library-count">
                {savedDocuments.length}{" "}
                {savedDocuments.length === 1
                  ? "document"
                  : "documents"}
              </span>
            </div>

            {libraryError && (
              <p className="library-error" role="alert">
                {libraryError}
              </p>
            )}

            {savedDocuments.length === 0 ? (
              <div className="empty-library">
                <strong>Your local library is empty.</strong>
                <span>
                  Paste a text or upload a PDF to save your first reading.
                </span>
              </div>
            ) : (
              <div className="document-grid">
                {savedDocuments.map((savedDocument) => {
                  const exactDocumentProgress =
                    savedDocument.wordCount <= 1
                      ? 0
                      : (savedDocument.currentWordIndex /
                          (savedDocument.wordCount - 1)) *
                        100;

                  const progressLabel =
                    exactDocumentProgress > 0 &&
                    exactDocumentProgress < 1
                      ? "<1"
                      : Math.round(exactDocumentProgress).toString();

                  return (
                    <article
                      className="saved-document-card"
                      key={savedDocument.id}
                    >
                      <div className="saved-document-main">
                        <span className="saved-document-date">
                          Updated{" "}
                          {new Date(
                            savedDocument.updatedAt,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>

                        <h3>{savedDocument.title}</h3>

                        <p>
                          Word{" "}
                          {Math.min(
                            savedDocument.currentWordIndex + 1,
                            savedDocument.wordCount,
                          ).toLocaleString("en-US")}{" "}
                          of{" "}
                          {savedDocument.wordCount.toLocaleString(
                            "en-US",
                          )}{" "}
                          · {progressLabel}% complete
                        </p>
                      </div>

                      <div className="saved-document-progress">
                        <span
                          style={{
                            width: `${exactDocumentProgress}%`,
                          }}
                        />
                      </div>

                      <div className="saved-document-actions">
                        <button
                          className="continue-document-button"
                          type="button"
                          onClick={() =>
                            continueSavedDocument(savedDocument)
                          }
                        >
                          {savedDocument.currentWordIndex > 0
                            ? "Continue"
                            : "Start"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            restartSavedDocument(savedDocument)
                          }
                        >
                          Restart
                        </button>

                        <button
                          className="delete-document-button"
                          type="button"
                          onClick={() =>
                            deleteSavedDocument(savedDocument)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="reader-shell">
      <header className="site-header">
        <button
          className="brand brand-button"
          type="button"
          onClick={returnHome}
          aria-label="Return to home"
        >
          <span className="brand-mark" />
          RSVP Reader
        </button>

        <button
          className="reader-exit-button"
          type="button"
          onClick={returnHome}
        >
          Exit reader
          <kbd>Esc</kbd>
        </button>
      </header>

      <div
        ref={documentLayerRef}
        className="document-layer"
        aria-hidden="true"
      >
        <article className="document-page">
          <p>
            {words.map((word, index) => (
              <span
                key={`${word}-${index}`}
                ref={
                  index === currentWordIndex
                    ? activeBackgroundWordRef
                    : null
                }
                className={
                  index === currentWordIndex
                    ? "document-word active"
                    : "document-word"
                }
              >
                {word}{" "}
              </span>
            ))}
          </p>
        </article>
      </div>

      <div className="background-shade" />

      <main className="reader-content">
        <section className="reader-panel">
          <div className="reader-status">
            <span>{documentTitle}</span>

            <span>
              {activeDocumentId
                ? lastSavedAt
                  ? "Saved locally"
                  : "Saving..."
                : "Demo not saved"}{" "}
              · {currentWordIndex + 1} / {words.length}
            </span>
          </div>

          <div className="word-frame">
            <div
              className="focus-word"
              style={{ fontSize: `${fontSize}px` }}
              aria-live="polite"
            >
              <span className="word-left">{wordBeforeFocus}</span>
              <span className="focus-letter">{focusLetter}</span>
              <span className="word-right">{wordAfterFocus}</span>
            </div>
          </div>

          <div className="playback-controls">
            <button
              className="control-button secondary"
              type="button"
              onClick={previousWord}
              disabled={currentWordIndex === 0}
              aria-label="Previous word"
              title="Previous word — A or Left Arrow"
            >
              ←
            </button>

            <button
              className="control-button primary"
              type="button"
              onClick={togglePlayback}
              disabled={words.length === 0}
              aria-label={
                isPlaying ? "Pause reading" : "Start reading"
              }
              title="Play or pause — Space"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              className="control-button secondary"
              type="button"
              onClick={nextWord}
              disabled={currentWordIndex === words.length - 1}
              aria-label="Next word"
              title="Next word — D or Right Arrow"
            >
              →
            </button>
          </div>

          <div className="settings-row">
            <div className="setting-control">
              <span className="setting-label">Reading speed</span>

              <div className="setting-buttons">
                <button
                  type="button"
                  onClick={decreaseSpeed}
                  disabled={wordsPerMinute === MIN_WPM}
                  aria-label="Decrease reading speed"
                >
                  −
                </button>

                <strong>
                  {wordsPerMinute.toLocaleString("en-US")} WPM
                </strong>

                <button
                  type="button"
                  onClick={increaseSpeed}
                  disabled={wordsPerMinute === MAX_WPM}
                  aria-label="Increase reading speed"
                >
                  +
                </button>
              </div>
            </div>

            <div className="setting-control">
              <span className="setting-label">Font size</span>

              <div className="setting-buttons">
                <button
                  type="button"
                  onClick={decreaseFontSize}
                  disabled={fontSize === MIN_FONT_SIZE}
                  aria-label="Decrease font size"
                >
                  −
                </button>

                <strong>{fontSize}px</strong>

                <button
                  type="button"
                  onClick={increaseFontSize}
                  disabled={fontSize === MAX_FONT_SIZE}
                  aria-label="Increase font size"
                >
                  +
                </button>
              </div>
            </div>

            <div className="setting-control natural-pauses-control">
              <div className="natural-pauses-description">
                <span className="setting-label">Natural pauses</span>

                <span className="setting-description">
                  Add extra time after punctuation and long words.
                </span>
              </div>

              <button
                className={
                  useNaturalPauses
                    ? "timing-toggle active"
                    : "timing-toggle"
                }
                type="button"
                onClick={() =>
                  setUseNaturalPauses(
                    (currentValue) => !currentValue,
                  )
                }
                aria-pressed={useNaturalPauses}
              >
                <span className="timing-toggle-track">
                  <span className="timing-toggle-knob" />
                </span>

                {useNaturalPauses ? "On" : "Off"}
              </button>
            </div>
          </div>

          <div className="progress-section">
            <div className="progress-information">
              <span>
                Approximately {estimatedMinutes} min remaining
              </span>

              <span>{Math.round(progress)}%</span>
            </div>

            <div
              className="progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="keyboard-shortcuts">
            <span>
              <kbd>A</kbd> / <kbd>←</kbd> Previous
            </span>

            <span>
              <kbd>Space</kbd> Play or pause
            </span>

            <span>
              <kbd>D</kbd> / <kbd>→</kbd> Next
            </span>

            <span>
              <kbd>W</kbd> / <kbd>↑</kbd> Faster
            </span>

            <span>
              <kbd>S</kbd> / <kbd>↓</kbd> Slower
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;