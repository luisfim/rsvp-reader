import type { LibraryMode } from "../types/app";
import { supabase } from "./supabase";

export type FeedbackCategory =
  | "bug"
  | "suggestion"
  | "usability"
  | "pdf"
  | "sync"
  | "other";

export interface FeedbackDraft {
  category: FeedbackCategory;
  rating: number | null;
  message: string;
  contactEmail: string;
  includeDiagnostics: boolean;
}

export interface FeedbackDiagnostics {
  generatedAt: string;
  appVersion: string;
  pagePath: string;
  online: boolean;
  authenticated: boolean;
  libraryMode: LibraryMode;
  language: string;
  userAgent: string;
  platform: string;
  viewport: string;
  screen: string;
  colorScheme: "dark" | "light" | "unknown";
  reducedMotion: boolean;
  serviceWorkerSupported: boolean;
}

interface DiagnosticContext {
  pagePath: string;
  authenticated: boolean;
  libraryMode: LibraryMode;
  now?: string;
}

interface FeedbackSubmissionContext extends DiagnosticContext {
  userId: string | null;
}

export interface FeedbackSubmissionResult {
  error: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 4000;

export function validateFeedbackDraft(draft: FeedbackDraft): string {
  const message = draft.message.trim();
  const contactEmail = draft.contactEmail.trim();

  if (message.length < MIN_MESSAGE_LENGTH) {
    return `Describe your feedback in at least ${MIN_MESSAGE_LENGTH} characters.`;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return `Keep your feedback under ${MAX_MESSAGE_LENGTH.toLocaleString("en-US")} characters.`;
  }

  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    return "Enter a valid contact email or leave the field empty.";
  }

  if (
    draft.rating !== null &&
    (!Number.isInteger(draft.rating) ||
      draft.rating < 1 ||
      draft.rating > 5)
  ) {
    return "Choose a rating from 1 to 5.";
  }

  return "";
}

function readMediaPreference(query: string): boolean {
  return typeof window.matchMedia === "function" &&
    window.matchMedia(query).matches;
}

export function createFeedbackDiagnostics({
  pagePath,
  authenticated,
  libraryMode,
  now = new Date().toISOString(),
}: DiagnosticContext): FeedbackDiagnostics {
  const viewportWidth = Math.max(0, Math.round(window.innerWidth));
  const viewportHeight = Math.max(0, Math.round(window.innerHeight));
  const screenWidth = Math.max(0, Math.round(window.screen?.width ?? 0));
  const screenHeight = Math.max(0, Math.round(window.screen?.height ?? 0));
  const prefersDark = readMediaPreference("(prefers-color-scheme: dark)");
  const prefersLight = readMediaPreference("(prefers-color-scheme: light)");

  return {
    generatedAt: now,
    appVersion: import.meta.env.VITE_APP_VERSION?.trim() || "beta",
    pagePath,
    online: navigator.onLine,
    authenticated,
    libraryMode,
    language: navigator.language || "unknown",
    userAgent: navigator.userAgent || "unknown",
    platform: navigator.platform || "unknown",
    viewport: `${viewportWidth}x${viewportHeight}`,
    screen: `${screenWidth}x${screenHeight}`,
    colorScheme: prefersDark ? "dark" : prefersLight ? "light" : "unknown",
    reducedMotion: readMediaPreference("(prefers-reduced-motion: reduce)"),
    serviceWorkerSupported: "serviceWorker" in navigator,
  };
}

export function createFeedbackPayload(
  draft: FeedbackDraft,
  context: FeedbackSubmissionContext,
) {
  return {
    user_id: context.userId,
    category: draft.category,
    rating: draft.rating,
    message: draft.message.trim(),
    contact_email: draft.contactEmail.trim() || null,
    include_diagnostics: draft.includeDiagnostics,
    diagnostics: draft.includeDiagnostics
      ? createFeedbackDiagnostics(context)
      : null,
    page_path: context.pagePath,
  };
}

function friendlyFeedbackError(message: string): string {
  const normalizedMessage = message.toLocaleLowerCase();

  if (
    normalizedMessage.includes("beta_feedback") ||
    normalizedMessage.includes("schema cache") ||
    normalizedMessage.includes("relation")
  ) {
    return "Feedback storage is not ready yet. Apply the beta_feedback Supabase migration and try again.";
  }

  if (
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("network")
  ) {
    return "Feedback could not be sent while offline. Reconnect and try again.";
  }

  return "Feedback could not be sent. Try again or use the support email.";
}

export async function submitBetaFeedback(
  draft: FeedbackDraft,
  context: FeedbackSubmissionContext,
): Promise<FeedbackSubmissionResult> {
  const validationError = validateFeedbackDraft(draft);

  if (validationError) {
    return { error: validationError };
  }

  if (!supabase) {
    return {
      error:
        "Feedback submission is unavailable because Supabase is not configured.",
    };
  }

  try {
    const { error } = await supabase
      .from("beta_feedback")
      .insert(createFeedbackPayload(draft, context));

    if (error) {
      return { error: friendlyFeedbackError(error.message) };
    }

    return { error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown feedback error";

    return { error: friendlyFeedbackError(message) };
  }
}
