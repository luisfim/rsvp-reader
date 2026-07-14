import type {
  ChangeEvent,
  RefObject,
} from "react";

import type { SavedDocument } from "../lib/library";
import type { CloudConnectionStatus } from "../types/app";
import { AppHeader } from "../components/layout/AppHeader";

interface HomePageProps {
  userEmail?: string | null;
  accountLabel: string;
  cloudConnectionLabel: string | null;
  cloudConnectionStatus: CloudConnectionStatus;
  isOnline: boolean;
  savedDocumentCount: number;
  latestDocument: SavedDocument | null;
  latestDocumentProgress: number;
  latestDocumentProgressLabel: string;
  pastedWordCount: number;
  draftTitle: string;
  draftText: string;
  formError: string;
  pdfFileName: string;
  isExtractingPdf: boolean;
  pdfProgress: number;
  pdfInputRef: RefObject<HTMLInputElement | null>;
  onNavigateHome: () => void;
  onOpenLibrary: () => void;
  onOpenAccount: () => void;
  onOpenHelp: () => void;
  onStartDemo: () => void;
  onContinueDocument: (document: SavedDocument) => void;
  onDraftTitleChange: (value: string) => void;
  onDraftTextChange: (value: string) => void;
  onStartReading: () => void;
  onPdfUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function HomePage({
  userEmail,
  accountLabel,
  cloudConnectionLabel,
  cloudConnectionStatus,
  isOnline,
  savedDocumentCount,
  latestDocument,
  latestDocumentProgress,
  latestDocumentProgressLabel,
  pastedWordCount,
  draftTitle,
  draftText,
  formError,
  pdfFileName,
  isExtractingPdf,
  pdfProgress,
  pdfInputRef,
  onNavigateHome,
  onOpenLibrary,
  onOpenAccount,
  onOpenHelp,
  onStartDemo,
  onContinueDocument,
  onDraftTitleChange,
  onDraftTextChange,
  onStartReading,
  onPdfUpload,
}: HomePageProps) {
  return (
    <div className="landing-shell">
      <AppHeader
        activePage="home"
        savedDocumentCount={savedDocumentCount}
        userEmail={userEmail}
        accountLabel={accountLabel}
        cloudConnectionLabel={cloudConnectionLabel}
        cloudConnectionStatus={cloudConnectionStatus}
        isOnline={isOnline}
        onNavigateHome={onNavigateHome}
        onOpenLibrary={onOpenLibrary}
        onOpenAccount={onOpenAccount}
        onOpenHelp={onOpenHelp}
      />

      <main className="landing-main">
        <section className="hero-section">
          <div className="hero-copy">
            <span className="eyebrow">Read without losing focus</span>

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
              <span>
                {userEmail
                  ? "Cloud-synced library"
                  : "Local reading library"}
              </span>
            </div>

            <button
              className="demo-button"
              type="button"
              onClick={onStartDemo}
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
                  of {latestDocument.wordCount.toLocaleString("en-US")}
                </p>

                <div
                  className="continue-reading-progress"
                  aria-hidden="true"
                >
                  <span
                    style={{ width: `${latestDocumentProgress}%` }}
                  />
                </div>

                <div className="continue-reading-actions">
                  <button
                    className="continue-latest-button"
                    type="button"
                    onClick={() =>
                      onContinueDocument(latestDocument)
                    }
                  >
                    Continue
                    <span aria-hidden="true">→</span>
                  </button>

                  <button
                    className="view-library-button"
                    type="button"
                    onClick={onOpenLibrary}
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
              onChange={(event) =>
                onDraftTitleChange(event.target.value)
              }
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
              onChange={(event) =>
                onDraftTextChange(event.target.value)
              }
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
              onClick={onStartReading}
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
              onChange={onPdfUpload}
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
                    <span style={{ width: `${pdfProgress}%` }} />
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
      </main>
    </div>
  );
}
