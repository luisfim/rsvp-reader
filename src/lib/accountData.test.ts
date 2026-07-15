import { describe, expect, it } from "vitest";
import {
  createAccountDataExport,
  createAccountExportFilename,
  serializeAccountDataExport,
} from "./accountData";
import type { SavedDocument } from "./library";

const document: SavedDocument = {
  id: "document-1",
  title: "A saved book",
  text: "One two three.",
  wordCount: 3,
  currentWordIndex: 1,
  wordsPerMinute: 525,
  fontSize: 80,
  useNaturalPauses: true,
  archivedAt: null,
  trashedAt: null,
  createdAt: "2026-07-10T10:00:00.000Z",
  updatedAt: "2026-07-15T10:00:00.000Z",
};

describe("account data exports", () => {
  it("includes account metadata and complete document contents", () => {
    const dataExport = createAccountDataExport({
      account: {
        id: "user-1",
        email: "reader@example.com",
        createdAt: "2026-07-01T10:00:00.000Z",
        lastSignInAt: "2026-07-15T09:00:00.000Z",
      },
      documents: [document],
      libraryMode: "cloud",
      exportedAt: "2026-07-15T12:00:00.000Z",
    });

    expect(dataExport.documents[0]).toMatchObject({
      text: "One two three.",
      currentWordIndex: 1,
      wordsPerMinute: 525,
      useNaturalPauses: true,
    });
    expect(dataExport.account.email).toBe("reader@example.com");
    expect(dataExport.libraryMode).toBe("cloud");
  });

  it("serializes the export as readable JSON", () => {
    const serializedExport = serializeAccountDataExport(
      createAccountDataExport({
        account: {
          id: "user-1",
          email: null,
          createdAt: null,
          lastSignInAt: null,
        },
        documents: [document],
        libraryMode: "local",
        exportedAt: "2026-07-15T12:00:00.000Z",
      }),
    );

    expect(serializedExport).toContain('\n  "version": 1');
    expect(JSON.parse(serializedExport).documents).toHaveLength(1);
  });

  it("creates a safe dated filename", () => {
    expect(
      createAccountExportFilename(
        "Luis+Reader@example.com",
        "2026-07-15T12:00:00.000Z",
      ),
    ).toBe("fixpoint-luis-reader-example.com-2026-07-15.json");
  });
});
