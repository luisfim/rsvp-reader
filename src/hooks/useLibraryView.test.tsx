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
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-14T00:00:00.000Z",
  },
  {
    id: "middle",
    title: "Blue Essay",
    text: "one two three four five",
    wordCount: 5,
    currentWordIndex: 0,
    wordsPerMinute: 350,
    fontSize: 64,
    useNaturalPauses: false,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
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
  it("selects the latest document and calculates its progress", () => {
    const { result } = renderHook(() => useTestLibraryView());

    expect(result.current.latestDocument?.id).toBe("latest");
    expect(result.current.latestDocumentProgress).toBe(75);
    expect(result.current.latestDocumentProgressLabel).toBe("75");
  });

  it("filters by title and supports each sorting mode", () => {
    const { result } = renderHook(() => useTestLibraryView());

    expect(result.current.visibleDocuments.map(({ id }) => id)).toEqual([
      "latest",
      "middle",
      "older",
    ]);

    act(() => {
      result.current.setLibrarySort("title");
    });

    expect(result.current.visibleDocuments.map(({ id }) => id)).toEqual([
      "latest",
      "middle",
      "older",
    ]);

    act(() => {
      result.current.setLibrarySort("progress");
    });

    expect(result.current.visibleDocuments.map(({ id }) => id)).toEqual([
      "latest",
      "older",
      "middle",
    ]);

    act(() => {
      result.current.setLibraryQuery("blue");
    });

    expect(result.current.visibleDocuments.map(({ id }) => id)).toEqual([
      "middle",
    ]);
  });

  it("renames a document and updates the active reader title", () => {
    const { result } = renderHook(() =>
      useTestLibraryView("latest"),
    );

    act(() => {
      result.current.startRenamingDocument(documents[1]);
    });

    expect(result.current.renamingDocumentId).toBe("latest");
    expect(result.current.renameValue).toBe("Alpha Book");

    act(() => {
      result.current.setRenameValue("  Calm Reading  ");
    });

    act(() => {
      result.current.saveRenamedDocument(documents[1]);
    });

    expect(
      result.current.savedDocuments.find(
        (document) => document.id === "latest",
      )?.title,
    ).toBe("Calm Reading");
    expect(result.current.renameActiveDocument).toHaveBeenCalledWith(
      "Calm Reading",
    );
    expect(result.current.renamingDocumentId).toBeNull();
    expect(result.current.renameValue).toBe("");
  });

  it("cancels renaming and ignores an empty title", () => {
    const { result } = renderHook(() => useTestLibraryView());

    act(() => {
      result.current.startRenamingDocument(documents[0]);
      result.current.setRenameValue("   ");
    });

    act(() => {
      result.current.saveRenamedDocument(documents[0]);
    });

    expect(result.current.savedDocuments[0].title).toBe("Zebra Notes");
    expect(result.current.renamingDocumentId).toBe("older");

    act(() => {
      result.current.cancelRenamingDocument();
    });

    expect(result.current.renamingDocumentId).toBeNull();
    expect(result.current.renameValue).toBe("");
  });
});
