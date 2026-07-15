import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router";
import { AppHeader } from "../components/layout/AppHeader";
import { InfoNavigation } from "../components/layout/InfoNavigation";
import { SiteFooter } from "../components/layout/SiteFooter";
import { getSupportMailto, siteConfig } from "../config/site";
import {
  createFeedbackDiagnostics,
  submitBetaFeedback,
  type FeedbackCategory,
} from "../lib/feedback";
import type {
  CloudConnectionStatus,
  LibraryMode,
} from "../types/app";

interface FeedbackPageProps {
  userId: string | null;
  userEmail?: string | null;
  accountLabel: string;
  cloudConnectionLabel: string | null;
  cloudConnectionStatus: CloudConnectionStatus;
  isOnline: boolean;
  libraryMode: LibraryMode;
  savedDocumentCount: number;
  onNavigateHome: () => void;
  onOpenLibrary: () => void;
  onOpenAccount: () => void;
  onOpenHelp: () => void;
}

const CATEGORY_OPTIONS: Array<{
  value: FeedbackCategory;
  label: string;
}> = [
  { value: "bug", label: "Bug or broken behavior" },
  { value: "suggestion", label: "Feature suggestion" },
  { value: "usability", label: "Reading comfort or usability" },
  { value: "pdf", label: "PDF import" },
  { value: "sync", label: "Account or synchronization" },
  { value: "other", label: "Other" },
];

export function FeedbackPage({
  userId,
  userEmail,
  accountLabel,
  cloudConnectionLabel,
  cloudConnectionStatus,
  isOnline,
  libraryMode,
  savedDocumentCount,
  onNavigateHome,
  onOpenLibrary,
  onOpenAccount,
  onOpenHelp,
}: FeedbackPageProps) {
  const [category, setCategory] =
    useState<FeedbackCategory>("usability");
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState(userEmail ?? "");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const pagePath = window.location.hash.replace(/^#/, "") || "/feedback";
  const supportMailto = getSupportMailto("RSVP Reader beta feedback");
  const diagnosticPreview = useMemo(
    () =>
      createFeedbackDiagnostics({
        pagePath,
        authenticated: Boolean(userId),
        libraryMode,
      }),
    [libraryMode, pagePath, userId],
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `Beta Feedback · ${siteConfig.name}`;

    return () => {
      document.title = previousTitle;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Honeypot field: quietly accept automated submissions without storing them.
    if (website.trim()) {
      setSuccessMessage("Thank you. Your feedback was received.");
      return;
    }

    setIsSubmitting(true);

    const result = await submitBetaFeedback(
      {
        category,
        rating,
        message,
        contactEmail,
        includeDiagnostics,
      },
      {
        userId,
        pagePath,
        authenticated: Boolean(userId),
        libraryMode,
      },
    );

    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    setMessage("");
    setRating(null);
    setSuccessMessage(
      "Thank you. Your feedback was added to the beta review queue.",
    );
  }

  return (
    <div className="landing-shell info-page-shell">
      <AppHeader
        activePage="info"
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

      <main className="info-page-main feedback-page-main">
        <InfoNavigation activePage="feedback" />

        <article className="info-page-article feedback-page-article">
          <header className="info-page-heading">
            <span className="eyebrow">Public beta</span>
            <h1>Beta Feedback</h1>
            <p className="feedback-introduction">
              Report a problem or describe an improvement. Do not paste
              passwords or the full text of private documents.
            </p>
          </header>

          <form className="feedback-form" onSubmit={handleSubmit}>
            <div className="feedback-field-grid">
              <label className="feedback-field">
                <span>Feedback type</span>
                <select
                  aria-label="Feedback type"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as FeedbackCategory)
                  }
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="feedback-rating-field">
                <legend>Overall experience (optional)</legend>
                <div className="feedback-rating-buttons">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={rating === value ? "active" : ""}
                      aria-pressed={rating === value}
                      aria-label={`${value} out of 5`}
                      onClick={() =>
                        setRating((currentRating) =>
                          currentRating === value ? null : value,
                        )
                      }
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <label className="feedback-field">
              <span>Your feedback</span>
              <textarea
                aria-label="Your feedback"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="What happened? What did you expect? Include the steps needed to reproduce a bug."
                minLength={10}
                maxLength={4000}
                required
              />
              <small>{message.length.toLocaleString("en-US")} / 4,000</small>
            </label>

            <label className="feedback-field">
              <span>Contact email (optional)</span>
              <input
                aria-label="Contact email (optional)"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="reader@example.com"
                maxLength={320}
              />
              <small>
                Add an address only when a reply would be useful.
              </small>
            </label>

            <label className="feedback-diagnostics-option">
              <input
                aria-label="Include technical diagnostics"
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(event) =>
                  setIncludeDiagnostics(event.target.checked)
                }
              />
              <span>
                <strong>Include technical diagnostics</strong>
                <small>
                  Browser, device dimensions, route, connectivity and library
                  mode. Document text and titles are never included.
                </small>
              </span>
            </label>

            {includeDiagnostics && (
              <details className="feedback-diagnostics-preview">
                <summary>Review diagnostic details</summary>
                <dl>
                  <div>
                    <dt>App version</dt>
                    <dd>{diagnosticPreview.appVersion}</dd>
                  </div>
                  <div>
                    <dt>Page</dt>
                    <dd>{diagnosticPreview.pagePath}</dd>
                  </div>
                  <div>
                    <dt>Connection</dt>
                    <dd>{diagnosticPreview.online ? "Online" : "Offline"}</dd>
                  </div>
                  <div>
                    <dt>Library</dt>
                    <dd>{diagnosticPreview.libraryMode}</dd>
                  </div>
                  <div>
                    <dt>Viewport</dt>
                    <dd>{diagnosticPreview.viewport}</dd>
                  </div>
                  <div>
                    <dt>Browser</dt>
                    <dd>{diagnosticPreview.userAgent}</dd>
                  </div>
                </dl>
              </details>
            )}

            <label className="feedback-honeypot" aria-hidden="true">
              Website
              <input
                type="text"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>

            {errorMessage && (
              <p className="feedback-form-message error" role="alert">
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p className="feedback-form-message success" role="status">
                {successMessage}
              </p>
            )}

            <div className="feedback-form-actions">
              <button
                className="info-primary-link feedback-submit-button"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending…" : "Send feedback"}
              </button>

              {supportMailto && (
                <a className="info-secondary-link" href={supportMailto}>
                  Use email instead
                </a>
              )}
            </div>
          </form>

          <section className="feedback-privacy-note">
            <h2>How beta feedback is handled</h2>
            <p>
              Feedback is used to diagnose problems and improve the product.
              The optional contact address is used only to follow up about
              the report. See the <Link to="/privacy">Privacy Policy</Link>{" "}
              for retention and data-rights information.
            </p>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
