import { useEffect, useRef } from "react";

interface HelpDialogProps {
  isOpen: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onStartDemo: () => void;
}

export function HelpDialog({
  isOpen,
  isAuthenticated,
  onClose,
  onStartDemo,
}: HelpDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="help-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        aria-describedby="help-dialog-description"
      >
        <button
          ref={closeButtonRef}
          className="help-dialog-close"
          type="button"
          onClick={onClose}
          aria-label="Close help"
        >
          ×
        </button>

        <div className="help-dialog-intro">
          <span className="help-dialog-eyebrow">Getting started</span>
          <h2 id="help-dialog-title">Read with less eye movement.</h2>
          <p id="help-dialog-description">
            RSVP Reader keeps each word in one fixed position. The red
            letter marks the visual anchor, while the rest of the interface
            stays calm and unobtrusive.
          </p>
        </div>

        <div className="help-focus-preview" aria-hidden="true">
          <span>foc</span>
          <strong>u</strong>
          <span>sed</span>
        </div>

        <div className="help-steps">
          <article>
            <span className="help-step-number">01</span>
            <div>
              <h3>Add a document</h3>
              <p>Paste text or choose a PDF with selectable text.</p>
            </div>
          </article>

          <article>
            <span className="help-step-number">02</span>
            <div>
              <h3>Choose your pace</h3>
              <p>
                Adjust reading speed from 250 to 2,000 WPM and change the
                display size at any time.
              </p>
            </div>
          </article>

          <article>
            <span className="help-step-number">03</span>
            <div>
              <h3>Continue later</h3>
              <p>
                {isAuthenticated
                  ? "Your documents and progress synchronize with your account."
                  : "Documents save locally on this device. Sign in later for cloud synchronization."}
              </p>
            </div>
          </article>
        </div>

        <div className="help-shortcuts-section">
          <div>
            <span className="help-dialog-eyebrow">Reader shortcuts</span>
            <h3>Keep your hands on the keyboard.</h3>
          </div>

          <div className="help-shortcuts-grid">
            <span><kbd>Space</kbd> Play or pause</span>
            <span><kbd>A</kbd> / <kbd>←</kbd> Previous word</span>
            <span><kbd>D</kbd> / <kbd>→</kbd> Next word</span>
            <span><kbd>W</kbd> / <kbd>↑</kbd> Faster</span>
            <span><kbd>S</kbd> / <kbd>↓</kbd> Slower</span>
            <span><kbd>F</kbd> Focus mode</span>
            <span><kbd>Home</kbd> Start</span>
            <span><kbd>End</kbd> Finish</span>
            <span><kbd>?</kbd> Open this guide</span>
          </div>
        </div>

        <div className="help-dialog-actions">
          <button
            className="help-dialog-secondary"
            type="button"
            onClick={onClose}
          >
            Continue exploring
          </button>

          <button
            className="help-dialog-primary"
            type="button"
            onClick={onStartDemo}
          >
            Try the demonstration
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </div>
  );
}
