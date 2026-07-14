import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SavedDocument } from "../lib/library";
import { useLibraryView } from "./useLibraryView";

const documents: SavedDocument[] = [
  {
    id: "older",
    title: "Zebra Notes",
    text: "one two three four five",
    wordCount: 5,
    currentWordIndex: 1,
    wordsPerMinute: 400,
    fontSize: 72,
    useNaturalPauses: false,
    archivedAt: null,
    trashedAt: null,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
  },
  {
    id: "latest",
    title: "Alpha Book",
    text: "one two three four five",
    wordCount: 5,
    currentWordIndex: 3,
    wordsPerMinute: 500,
    fontSize: 80,
    useNaturalPauses: true,
    archivedAt: null,
    trashedAt: null,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-14T00:00:00.000Z",
  },
  {
    id: "archived",
    title: "Archived Essay",
    text: "one two three",
    wordCount: 3,
    currentWordIndex: 0,
    wordsPerMinute: 350,
    fontSize: 64,
    useNaturalPauses: false,
    archivedAt: "2026-07-13T00:00:00.000Z",
    trashedAt: null,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
  },
  {
    id: "trashed",
    title: "Deleted Draft",
    text: "one two",
    wordCount: 2,
    currentWordIndex: 0,
    wordsPerMinute: 400,
    fontSize: 72,
    useNaturalPauses: false,
    archivedAt: null,
    trashedAt: "2026-07-12T00:00:00.000Z",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
  },
];

function useTestLibraryView(activeDocumentId: string | null = null) {
  const [savedDocuments, setSavedDocuments] = useState(documents);
  const renameActiveDocument = useRef(vi.fn()).current;

  const libraryView = useLibraryView({
    savedDocuments,
    setSavedDocuments,
    activeDocumentId,
    renameActiveDocument,
  });

  return {
    ...libraryView,
    savedDocuments,
    renameActiveDocument,
  };
}

describe("useLibraryView", () => {
  it("uses only active documents for the latest reading card", () => {
    const { result } = renderHook(() => useTestLibraryView());

    expect(result.current.latestDocument?.id).toBe("latest");
    expect(result.current.latestDocumentProgress).toBe(75);
    expect(result.current.activeDocumentCount).toBe(2);
    expect(result.current.archivedDocumentCount).toBe(1);
    expect(result.current.trashedDocumentCount).toBe(1);
  });

  it("filters and sorts the selected section", () => {
    const { result } = renderHook(() => useTestLibraryView());

    expect(result.current.visibleDocuments.map(({ id }) => id)).toEqual([
      "latest",
      "older",
    ]);

    act(() => result.current.setLibrarySort("title"));
    expect(result.current.visibleDocuments.map(({ id }) => id)).toEqual([
      "latest",
      "older",
    ]);

    act(() => result.current.setLibraryQuery("zebra"));
    expect(result.current.visibleDocuments.map(({ id }) => id)).toEqual([
      "older",
    ]);

    act(() => result.current.setLibrarySection("archived"));
    expect(result.current.libraryQuery).toBe("");
    expect(result.current.visibleDocuments.map(({ id }) => id)).toEqual([
      "archived",
    ]);
  });

  it("edits title and text while keeping progress within bounds", () => {
    const { result } = renderHook(() =>
      useTestLibraryView("latest"),
    );

    act(() => result.current.startEditingDocument(documents[1]));
    act(() => {
      result.current.setEditTitle("  Calm Reading  ");
      result.current.setEditText("first second");
    });
    act(() => {
      expect(result.current.saveEditedDocument()).toBe(true);
    });

    const editedDocument = result.current.savedDocuments.find(
      (document) => document.id === "latest",
    );

    expect(editedDocument).toMatchObject({
      title: "Calm Reading",
      text: "first second",
      wordCount: 2,
      currentWordIndex: 1,
    });
    expect(result.current.renameActiveDocument).toHaveBeenCalledWith(
      "Calm Reading",
    );
    expect(result.current.editingDocumentId).toBeNull();
  });

  it("rejects empty edited content", () => {
    const { result } = renderHook(() => useTestLibraryView());

    act(() => result.current.startEditingDocument(documents[0]));
    act(() => result.current.setEditText("   "));
    act(() => {
      expect(result.current.saveEditedDocument()).toBe(false);
    });

    expect(result.current.editError).toMatch(/at least one word/i);
    expect(result.current.editingDocumentId).toBe("older");
  });

  it("archives, trashes and restores documents", () => {
    const { result } = renderHook(() => useTestLibraryView());

    act(() => result.current.archiveDocument(documents[0]));
    expect(
      result.current.savedDocuments.find(({ id }) => id === "older")
        ?.archivedAt,
    ).toBeTruthy();

    const archivedDocument = result.current.savedDocuments.find(
      ({ id }) => id === "older",
    )!;

    act(() => result.current.moveDocumentToTrash(archivedDocument));
    expect(
      result.current.savedDocuments.find(({ id }) => id === "older")
        ?.trashedAt,
    ).toBeTruthy();
    expect(
      result.current.savedDocuments.find(({ id }) => id === "older")
        ?.archivedAt,
    ).toBeNull();

    const trashedDocument = result.current.savedDocuments.find(
      ({ id }) => id === "older",
    )!;

    act(() => result.current.restoreTrashedDocument(trashedDocument));
    expect(
      result.current.savedDocuments.find(({ id }) => id === "older"),
    ).toMatchObject({ archivedAt: null, trashedAt: null });
  });
});
