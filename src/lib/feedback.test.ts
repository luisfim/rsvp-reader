import { describe, expect, it } from "vitest";
import {
  createFeedbackDiagnostics,
  createFeedbackPayload,
  validateFeedbackDraft,
  type FeedbackDraft,
} from "./feedback";

const validDraft: FeedbackDraft = {
  category: "usability",
  rating: 4,
  message: "The reader feels comfortable at 450 WPM.",
  contactEmail: "reader@example.com",
  includeDiagnostics: true,
};

describe("feedback validation", () => {
  it("requires a useful message and validates an optional email", () => {
    expect(
      validateFeedbackDraft({
        ...validDraft,
        message: "Too short",
      }),
    ).toMatch(/at least 10 characters/i);

    expect(
      validateFeedbackDraft({
        ...validDraft,
        contactEmail: "not-an-email",
      }),
    ).toMatch(/valid contact email/i);

    expect(validateFeedbackDraft(validDraft)).toBe("");
  });
});

describe("feedback diagnostics", () => {
  it("describes the environment without document content", () => {
    const diagnostics = createFeedbackDiagnostics({
      pagePath: "/feedback",
      authenticated: false,
      libraryMode: "local",
      now: "2026-07-15T15:00:00.000Z",
    });

    expect(diagnostics).toMatchObject({
      generatedAt: "2026-07-15T15:00:00.000Z",
      pagePath: "/feedback",
      authenticated: false,
      libraryMode: "local",
    });
    expect(JSON.stringify(diagnostics)).not.toMatch(/document|book text/i);
  });

  it("omits diagnostics when the reader does not consent", () => {
    const payload = createFeedbackPayload(
      {
        ...validDraft,
        message: "  A clear suggestion for the beta.  ",
        contactEmail: "",
        includeDiagnostics: false,
      },
      {
        userId: null,
        pagePath: "/feedback",
        authenticated: false,
        libraryMode: "local",
        now: "2026-07-15T15:00:00.000Z",
      },
    );

    expect(payload).toMatchObject({
      user_id: null,
      message: "A clear suggestion for the beta.",
      contact_email: null,
      include_diagnostics: false,
      diagnostics: null,
      page_path: "/feedback",
    });
  });
});
