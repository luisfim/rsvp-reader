import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./App.css";

const DEMO_TEXT = `
Rapid Serial Visual Presentation is a reading method in which words are
displayed one at a time in the same position. By keeping the eyes focused
on a single point, the reader can move through a text without constantly
shifting attention across the page. This first version demonstrates the
core reading experience. Later, users will be able to paste their own text,
upload PDF documents, create an account, save books and continue reading
from exactly where they stopped.
`;

const MIN_WPM = 300;
const MAX_WPM = 600;
const WPM_STEP = 25;

const MIN_FONT_SIZE = 48;
const MAX_FONT_SIZE = 112;
const FONT_SIZE_STEP = 8;

function getFocusLetterIndex(word: string): number {
  const match = word.match(/[\p{L}\p{N}]+/u);

  if (!match || match.index === undefined) {
    return Math.max(0, Math.floor((word.length - 1) / 2));
  }

  const coreWord = match[0];
  const coreStart = match.index;
  const middleOfCore = Math.floor((coreWord.length - 1) / 2);

  return coreStart + middleOfCore;
}

function App() {
  const words = useMemo(
    () => DEMO_TEXT.trim().split(/\s+/).filter(Boolean),
    [],
  );

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wordsPerMinute, setWordsPerMinute] = useState(400);
  const [fontSize, setFontSize] = useState(72);

  const activeBackgroundWordRef = useRef<HTMLSpanElement | null>(null);

  const currentWord = words[currentWordIndex] ?? "";
  const focusLetterIndex = getFocusLetterIndex(currentWord);

  const wordBeforeFocus = currentWord.slice(0, focusLetterIndex);
  const focusLetter = currentWord[focusLetterIndex] ?? "";
  const wordAfterFocus = currentWord.slice(focusLetterIndex + 1);

  const progress =
    words.length > 1
      ? (currentWordIndex / (words.length - 1)) * 100
      : 100;

  const togglePlayback = useCallback(() => {
    if (words.length === 0) {
      return;
    }

    if (currentWordIndex >= words.length - 1) {
      setCurrentWordIndex(0);
      setIsPlaying(true);
      return;
    }

    setIsPlaying((currentValue) => !currentValue);
  }, [currentWordIndex, words.length]);

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
    if (!isPlaying) {
      return;
    }

    if (currentWordIndex >= words.length - 1) {
      setIsPlaying(false);
      return;
    }

    const delayInMilliseconds = 60_000 / wordsPerMinute;

    const timer = window.setTimeout(() => {
      setCurrentWordIndex((currentIndex) =>
        Math.min(words.length - 1, currentIndex + 1),
      );
    }, delayInMilliseconds);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentWordIndex,
    isPlaying,
    words.length,
    wordsPerMinute,
  ]);

  useEffect(() => {
    activeBackgroundWordRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  }, [currentWordIndex]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;

      const userIsTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (userIsTyping) {
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
    togglePlayback,
  ]);

  return (
    <div className="reader-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="RSVP Reader home">
          <span className="brand-mark" />
          RSVP Reader
        </a>

        <button className="sign-in-button" type="button">
          Sign in
        </button>
      </header>

      <div className="document-layer" aria-hidden="true">
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
            <span>Demo text</span>
            <span>
              {currentWordIndex + 1} / {words.length}
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
              aria-label={isPlaying ? "Pause reading" : "Start reading"}
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

                <strong>{wordsPerMinute} WPM</strong>

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
          </div>

          <div className="progress-section">
            <div className="progress-information">
              <span>Reading progress</span>
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