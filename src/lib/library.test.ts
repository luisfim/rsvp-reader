import { beforeEach, describe, expect, it } from "vitest";
import {
  createSavedDocument,
  loadSavedDocuments,
  persistSavedDocuments,
  type SavedDocument,
} from "./library";

const STORAGE_KEY = "rsvp-reader-library-v1";

function makeDocument(
  overrides: Partial<SavedDocument> = {},
): SavedDocument {
  return {
    id: "document-1",
    title: "Test document",
    text: "one two three",
    wordCount: 3,
    currentWordIndex: 0,
    wordsPerMinute: 400,
    fontSize: 72,
    useNaturalPauses: false,
    createdAt: "2026-07-14T10:00:00.000Z",
    updatedAt: "2026-07-14T10:00:00.000Z",
    ...overrides,
  };
}

describe("local document library", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates a new document at the beginning", () => {
    const document = createSavedDocument({
      title: "Chapter one",
      text: "A short chapter",
      wordCount: 3,
      wordsPerMinute: 400,
      fontSize: 72,
      useNaturalPauses: true,
    });

    expect(document.id).not.toBe("");
    expect(document.currentWordIndex).toBe(0);
    expect(document.useNaturalPauses).toBe(true);
  });

  it("persists and reloads documents by most recent update", () => {
    const older = makeDocument({
      id: "older",
      updatedAt: "2026-07-14T10:00:00.000Z",
    });
    const newer = makeDocument({
      id: "newer",
      updatedAt: "2026-07-14T12:00:00.000Z",
    });

    persistSavedDocuments([older, newer]);

    expect(loadSavedDocuments().map((document) => document.id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("repairs out-of-range settings from older stored versions", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          ...makeDocument(),
          currentWordIndex: 99,
          wordsPerMinute: 50,
          fontSize: 999,
        },
      ]),
    );

    const [document] = loadSavedDocuments();

    expect(document.currentWordIndex).toBe(2);
    expect(document.wordsPerMinute).toBe(250);
    expect(document.fontSize).toBe(112);
  });

  it("returns an empty library when storage contains invalid JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json");
    expect(loadSavedDocuments()).toEqual([]);
  });
});
