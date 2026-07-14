import type { RefObject } from "react";

import {
  MAX_FONT_SIZE,
  MAX_WPM,
  MIN_FONT_SIZE,
  MIN_WPM,
} from "../../config/reader";
import { getFocusLetterIndex } from "../../lib/reader";

interface ReaderPageProps {
  readerShellRef: RefObject<HTMLDivElement | null>;
  documentLayerRef: RefObject<HTMLDivElement | null>;
  activeBackgroundWordRef: RefObject<HTMLSpanElement | null>;
  words: string[];
  currentWordIndex: number;
  documentTitle: string;
  fontSize: number;
  isPlaying: boolean;
  wordsPerMinute: number;
  useNaturalPauses: boolean;
  readerSaveLabel: string;
  isFocusMode: boolean;
  areReaderControlsVisible: boolean;
  onRevealControls: () => void;
  onReturnHome: () => void;
  onReturnToLibrary: () => void;
  onToggleFocusMode: () => void | Promise<void>;
  onOpenHelp: () => void;
  onPreviousWord: () => void;
  onTogglePlayback: () => void;
  onNextWord: () => void;
  onDecreaseSpeed: () => void;
  onIncreaseSpeed: () => void;
  onDecreaseFontSize: () => void;
  onIncreaseFontSize: () => void;
  onToggleNaturalPauses: () => void;
  onSeekToWord: (index: number) => void;
  onRestartReading: () => void;
}

export function ReaderPage({
  readerShellRef,
  documentLayerRef,
  activeBackgroundWordRef,
  words,
  currentWordIndex,
  documentTitle,
  fontSize,
  isPlaying,
  wordsPerMinute,
  useNaturalPauses,
  readerSaveLabel,
  isFocusMode,
  areReaderControlsVisible,
  onRevealControls,
  onReturnHome,
  onReturnToLibrary,
  onToggleFocusMode,
  onOpenHelp,
  onPreviousWord,
  onTogglePlayback,
  onNextWord,
  onDecreaseSpeed,
  onIncreaseSpeed,
  onDecreaseFontSize,
  onIncreaseFontSize,
  onToggleNaturalPauses,
  onSeekToWord,
  onRestartReading,
}: ReaderPageProps) {
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

  const isReadingComplete =
    words.length > 0 &&
    currentWordIndex >= words.length - 1 &&
    !isPlaying;

  return (
    <div
      ref={readerShellRef}
      className={[
        "reader-shell",
        isFocusMode ? "focus-mode" : "",
        areReaderControlsVisible ? "controls-visible" : "controls-hidden",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerMove={onRevealControls}
      onPointerDown={onRevealControls}
    >
      <header className="site-header reader-site-header focus-fade-control">
        <button
          className="brand brand-button"
          type="button"
          onClick={onReturnHome}
          aria-label="Return to home"
        >
          <span className="brand-mark" />
          RSVP Reader
        </button>

        <div className="reader-header-actions">
          <button
            className="reader-help-button"
            type="button"
            onClick={onOpenHelp}
            title="Help and keyboard shortcuts"
          >
            Help
            <kbd>?</kbd>
          </button>

          <button
            className="reader-focus-button"
            type="button"
            onClick={() => void onToggleFocusMode()}
            aria-pressed={isFocusMode}
          >
            {isFocusMode ? "Exit focus" : "Focus mode"}
            <kbd>F</kbd>
          </button>

          <button
            className="reader-exit-button"
            type="button"
            onClick={onReturnHome}
          >
            Exit reader
            <kbd>Esc</kbd>
          </button>
        </div>
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
          <div className="reader-status focus-fade-control">
            <span>{documentTitle}</span>

            <span>
              {readerSaveLabel} · {currentWordIndex + 1} / {words.length}
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

          <div className="playback-controls focus-fade-control">
            <button
              className="control-button secondary"
              type="button"
              onClick={onPreviousWord}
              disabled={currentWordIndex === 0}
              aria-label="Previous word"
              title="Previous word — A or Left Arrow"
            >
              ←
            </button>

            <button
              className="control-button primary"
              type="button"
              onClick={onTogglePlayback}
              disabled={words.length === 0}
              aria-label={isPlaying ? "Pause reading" : "Start reading"}
              title="Play or pause — Space"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              className="control-button secondary"
              type="button"
              onClick={onNextWord}
              disabled={currentWordIndex === words.length - 1}
              aria-label="Next word"
              title="Next word — D or Right Arrow"
            >
              →
            </button>
          </div>

          <div className="settings-row focus-fade-control">
            <div className="setting-control">
              <span className="setting-label">Reading speed</span>

              <div className="setting-buttons">
                <button
                  type="button"
                  onClick={onDecreaseSpeed}
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
                  onClick={onIncreaseSpeed}
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
                  onClick={onDecreaseFontSize}
                  disabled={fontSize === MIN_FONT_SIZE}
                  aria-label="Decrease font size"
                >
                  −
                </button>

                <strong>{fontSize}px</strong>

                <button
                  type="button"
                  onClick={onIncreaseFontSize}
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
                onClick={onToggleNaturalPauses}
                aria-pressed={useNaturalPauses}
              >
                <span className="timing-toggle-track">
                  <span className="timing-toggle-knob" />
                </span>

                {useNaturalPauses ? "On" : "Off"}
              </button>
            </div>
          </div>

          <div className="progress-section focus-fade-control">
            <div className="progress-information">
              <span>Approximately {estimatedMinutes} min remaining</span>
              <span>{Math.round(progress)}%</span>
            </div>

            <div className="reader-seek-control">
              <div className="progress-track" aria-hidden="true">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <input
                className="reader-seek-input"
                type="range"
                min={0}
                max={Math.max(words.length - 1, 0)}
                step={1}
                value={currentWordIndex}
                onChange={(event) =>
                  onSeekToWord(Number(event.target.value))
                }
                aria-label="Reading position"
                aria-valuetext={`Word ${currentWordIndex + 1} of ${words.length}`}
              />
            </div>

            <div className="seek-help">
              <span>Drag the bar to jump through the text</span>
              <span>Home: start · End: finish</span>
            </div>
          </div>

          <div className="keyboard-shortcuts focus-fade-control">
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
            <span>
              <kbd>F</kbd> Focus mode
            </span>
          </div>

          {isReadingComplete && (
            <section
              className="completion-panel focus-fade-control"
              aria-labelledby="completion-title"
            >
              <div>
                <span className="completion-eyebrow">Reading complete</span>
                <h2 id="completion-title">You reached the end.</h2>
                <p>
                  Restart this text or return to your library to choose
                  another reading.
                </p>
              </div>

              <div className="completion-actions">
                <button
                  className="completion-primary-button"
                  type="button"
                  onClick={onRestartReading}
                >
                  Read again
                </button>

                <button
                  className="completion-secondary-button"
                  type="button"
                  onClick={onReturnToLibrary}
                >
                  Open library
                </button>
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
