import { describe, expect, it } from "vitest";

import type { SavedDocument } from "../lib/library";
import type { ReaderSnapshot } from "../types/reader";
import {
  createEmptyOfflineCloudState,
  documentLibrariesMatch,
  findDocumentsAvailableForImport,
  updateDocumentsFromReaderSnapshot,
} from "./useLibrarySync";

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

function makeSnapshot(
  overrides: Partial<ReaderSnapshot> = {},
): ReaderSnapshot {
  return {
    activeDocumentId: "document-1",
    currentWordIndex: 2,
    wordsPerMinute: 625,
    fontSize: 80,
    useNaturalPauses: true,
    ...overrides,
  };
}

describe("library synchronization helpers", () => {
  it("recognizes equivalent document libraries regardless of order", () => {
    const first = makeDocument({ id: "first" });
    const second = makeDocument({ id: "second" });

    expect(
      documentLibrariesMatch([first, second], [second, first]),
    ).toBe(true);
  });

  it("detects reading-setting changes that require synchronization", () => {
    const original = makeDocument();
    const changed = makeDocument({ wordsPerMinute: 425 });

    expect(documentLibrariesMatch([original], [changed])).toBe(false);
  });

  it("updates only the active document from a reader snapshot", () => {
    const active = makeDocument({ id: "document-1" });
    const untouched = makeDocument({ id: "document-2" });
    const updatedAt = "2026-07-14T11:00:00.000Z";

    const updatedDocuments = updateDocumentsFromReaderSnapshot(
      [active, untouched],
      makeSnapshot(),
      updatedAt,
    );

    expect(updatedDocuments[0]).toMatchObject({
      currentWordIndex: 2,
      wordsPerMinute: 625,
      fontSize: 80,
      useNaturalPauses: true,
      updatedAt,
    });
    expect(updatedDocuments[1]).toEqual(untouched);
  });

  it("does not alter documents when the snapshot is a demo", () => {
    const documents = [makeDocument()];

    expect(
      updateDocumentsFromReaderSnapshot(
        documents,
        makeSnapshot({ activeDocumentId: null }),
        "2026-07-14T11:00:00.000Z",
      ),
    ).toBe(documents);
  });

  it("offers only missing or newer local documents for import", () => {
    const newerLocal = makeDocument({
      id: "shared",
      updatedAt: "2026-07-14T12:00:00.000Z",
    });
    const localOnly = makeDocument({ id: "local-only" });
    const olderCloud = makeDocument({
      id: "shared",
      updatedAt: "2026-07-14T11:00:00.000Z",
    });

    expect(
      findDocumentsAvailableForImport(
        [newerLocal, localOnly],
        [olderCloud],
      ).map((document) => document.id),
    ).toEqual(["shared", "local-only"]);
  });

  it("creates an empty offline state with an epoch timestamp", () => {
    expect(createEmptyOfflineCloudState()).toEqual({
      documents: [],
      deletions: [],
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
  });
});
