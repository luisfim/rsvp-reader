import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SavedDocument } from "../lib/library";
import {
  getReaderRouteDocumentId,
  getScreenFromPath,
  useAppNavigation,
} from "./useAppNavigation";

const savedDocument: SavedDocument = {
  id: "document-1",
  title: "Test document",
  text: "one two three four",
  wordCount: 4,
  currentWordIndex: 2,
  wordsPerMinute: 450,
  fontSize: 72,
  useNaturalPauses: true,
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
};

function createWrapper(initialEntry = "/") {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        {children}
      </MemoryRouter>
    );
  };
}

function createOptions(overrides: Record<string, unknown> = {}) {
  return {
    screen: "home" as const,
    savedDocuments: [savedDocument],
    isLibraryLoading: false,
    isAuthenticated: false,
    activeDocumentId: null,
    loadReaderState: vi.fn(() => ({ success: true })),
    pauseReader: vi.fn(),
    clearActiveDocument: vi.fn(),
    exitFocusMode: vi.fn(async () => undefined),
    markReaderOpened: vi.fn(),
    saveActiveProgress: vi.fn(),
    persistCurrentSnapshot: vi.fn(),
    resetReaderView: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
});

describe("application route helpers", () => {
  it("classifies reader and non-reader paths", () => {
    expect(getScreenFromPath("/reader/demo")).toBe("reader");
    expect(getScreenFromPath("/library")).toBe("home");
    expect(getScreenFromPath("/")).toBe("home");
  });

  it("extracts and decodes the document id from reader paths", () => {
    expect(getReaderRouteDocumentId("/reader/book%201")).toBe(
      "book 1",
    );
    expect(getReaderRouteDocumentId("/library")).toBeNull();
  });
});

describe("useAppNavigation", () => {
  it("opens a saved document and initializes its reader session", () => {
    const options = createOptions();
    const { result } = renderHook(
      () => useAppNavigation(options),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.openReader(
        savedDocument.title,
        savedDocument.text,
        {
          documentId: savedDocument.id,
          startIndex: savedDocument.currentWordIndex,
        },
      );
    });

    expect(options.loadReaderState).toHaveBeenCalledWith(
      savedDocument.title,
      savedDocument.text,
      {
        documentId: savedDocument.id,
        startIndex: savedDocument.currentWordIndex,
      },
    );
    expect(options.markReaderOpened).toHaveBeenCalledWith(
      savedDocument.id,
    );
    expect(options.resetReaderView).toHaveBeenCalledTimes(1);
  });

  it("restores a saved document opened from a direct URL", async () => {
    const options = createOptions({ screen: "reader" as const });

    renderHook(() => useAppNavigation(options), {
      wrapper: createWrapper("/reader/document-1"),
    });

    await waitFor(() => {
      expect(options.loadReaderState).toHaveBeenCalledWith(
        savedDocument.title,
        savedDocument.text,
        {
          documentId: savedDocument.id,
          startIndex: savedDocument.currentWordIndex,
          savedWordsPerMinute: savedDocument.wordsPerMinute,
          savedFontSize: savedDocument.fontSize,
          savedNaturalPauses: savedDocument.useNaturalPauses,
        },
      );
    });

    expect(options.markReaderOpened).toHaveBeenCalledWith(
      savedDocument.id,
    );
  });

  it("persists and clears the reader before returning home", () => {
    const options = createOptions({ screen: "reader" as const });
    const { result } = renderHook(
      () => useAppNavigation(options),
      { wrapper: createWrapper("/reader/document-1") },
    );

    act(() => {
      result.current.returnHome();
    });

    expect(options.saveActiveProgress).toHaveBeenCalledTimes(1);
    expect(options.persistCurrentSnapshot).toHaveBeenCalledTimes(1);
    expect(options.pauseReader).toHaveBeenCalledTimes(1);
    expect(options.exitFocusMode).toHaveBeenCalledTimes(1);
    expect(options.clearActiveDocument).toHaveBeenCalledTimes(1);
  });
});
