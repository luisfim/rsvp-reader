import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_PDF_FILE_SIZE } from "../config/reader";
import { extractTextFromPdf } from "../lib/pdf";
import { useDocumentImport } from "./useDocumentImport";

vi.mock("../lib/pdf", () => ({
  extractTextFromPdf: vi.fn(),
}));

const mockedExtractTextFromPdf = vi.mocked(extractTextFromPdf);

function createFileChangeEvent(file?: File) {
  return {
    target: {
      files: file ? [file] : [],
      value: "selected-file",
    },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

describe("useDocumentImport", () => {
  beforeEach(() => {
    mockedExtractTextFromPdf.mockReset();
  });

  it("counts words and creates a saved document from pasted text", () => {
    const { result } = renderHook(() => useDocumentImport());

    act(() => {
      result.current.updateDraftTitle("  Test chapter  ");
      result.current.updateDraftText("One two three four");
    });

    expect(result.current.pastedWordCount).toBe(4);

    let document = null;

    act(() => {
      document = result.current.createDocumentFromDraft();
    });

    expect(document).toMatchObject({
      title: "Test chapter",
      text: "One two three four",
      wordCount: 4,
      wordsPerMinute: 400,
      fontSize: 72,
      useNaturalPauses: false,
    });
    expect(result.current.formError).toBe("");
  });

  it("uses an untitled fallback and rejects empty text", () => {
    const { result } = renderHook(() => useDocumentImport());

    let emptyDocument = null;

    act(() => {
      emptyDocument = result.current.createDocumentFromDraft();
    });

    expect(emptyDocument).toBeNull();
    expect(result.current.formError).toBe(
      "Paste some text before starting.",
    );

    act(() => {
      result.current.updateDraftText("Readable text");
    });

    let document = null;

    act(() => {
      document = result.current.createDocumentFromDraft();
    });

    expect(document).toMatchObject({ title: "Untitled text" });
  });

  it("rejects files that are not PDFs", async () => {
    const { result } = renderHook(() => useDocumentImport());
    const textFile = new File(["hello"], "notes.txt", {
      type: "text/plain",
    });

    await act(async () => {
      await result.current.handlePdfUpload(
        createFileChangeEvent(textFile),
      );
    });

    expect(result.current.formError).toBe("Choose a valid PDF file.");
    expect(result.current.pdfFileName).toBe("");
    expect(mockedExtractTextFromPdf).not.toHaveBeenCalled();
  });

  it("rejects PDFs larger than the configured limit", async () => {
    const { result } = renderHook(() => useDocumentImport());
    const largeFile = new File(["pdf"], "large.pdf", {
      type: "application/pdf",
    });

    Object.defineProperty(largeFile, "size", {
      value: MAX_PDF_FILE_SIZE + 1,
    });

    await act(async () => {
      await result.current.handlePdfUpload(
        createFileChangeEvent(largeFile),
      );
    });

    expect(result.current.formError).toBe(
      "Choose a PDF smaller than 20 MB.",
    );
    expect(mockedExtractTextFromPdf).not.toHaveBeenCalled();
  });

  it("loads extracted PDF text and derives the title from the filename", async () => {
    const { result } = renderHook(() => useDocumentImport());
    const pdfFile = new File(["pdf"], "Quiet Focus.pdf", {
      type: "application/pdf",
    });

    mockedExtractTextFromPdf.mockImplementation(
      async (_file, onProgress) => {
        onProgress?.(1, 2);
        onProgress?.(2, 2);
        return {
          text: "First page text. Second page text.",
          pageCount: 2,
          wordCount: 6,
          emptyPageCount: 0,
          removedRepeatedLines: 4,
          removedPageNumberLines: 2,
          warnings: [],
        };
      },
    );

    await act(async () => {
      await result.current.handlePdfUpload(
        createFileChangeEvent(pdfFile),
      );
    });

    expect(result.current.draftTitle).toBe("Quiet Focus");
    expect(result.current.draftText).toBe(
      "First page text. Second page text.",
    );
    expect(result.current.pastedWordCount).toBe(6);
    expect(result.current.pdfFileName).toBe("Quiet Focus.pdf");
    expect(result.current.pdfProgress).toBe(100);
    expect(result.current.isExtractingPdf).toBe(false);
    expect(result.current.formError).toBe("");
    expect(result.current.pdfImportDetails).toEqual({
      pageCount: 2,
      originalWordCount: 6,
      emptyPageCount: 0,
      removedRepeatedLines: 4,
      removedPageNumberLines: 2,
      warnings: [],
    });
  });

  it("keeps a custom title when a PDF is imported", async () => {
    const { result } = renderHook(() => useDocumentImport());
    const pdfFile = new File(["pdf"], "source.pdf", {
      type: "application/pdf",
    });

    mockedExtractTextFromPdf.mockResolvedValue({
      text: "Imported document text",
      pageCount: 1,
      wordCount: 3,
      emptyPageCount: 0,
      removedRepeatedLines: 0,
      removedPageNumberLines: 0,
      warnings: [],
    });

    act(() => {
      result.current.updateDraftTitle("My custom title");
    });

    await act(async () => {
      await result.current.handlePdfUpload(
        createFileChangeEvent(pdfFile),
      );
    });

    expect(result.current.draftTitle).toBe("My custom title");
  });
});
