import {
  type ChangeEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  DEFAULT_FONT_SIZE,
  DEFAULT_WPM,
  MAX_PDF_FILE_SIZE,
} from "../config/reader";
import {
  createSavedDocument,
  type SavedDocument,
} from "../lib/library";
import type { PdfExtractionResult } from "../lib/pdf";
import { tokenizeText } from "../lib/reader";

export interface PdfImportDetails {
  pageCount: number;
  originalWordCount: number;
  removedRepeatedLines: number;
  removedPageNumberLines: number;
  emptyPageCount: number;
  warnings: string[];
}

interface UseDocumentImportResult {
  draftTitle: string;
  draftText: string;
  formError: string;
  pdfFileName: string;
  isExtractingPdf: boolean;
  pdfProgress: number;
  pdfImportDetails: PdfImportDetails | null;
  pastedWordCount: number;
  pdfInputRef: React.RefObject<HTMLInputElement | null>;
  updateDraftTitle: (value: string) => void;
  updateDraftText: (value: string) => void;
  clearFormError: () => void;
  setImportError: (message: string) => void;
  createDocumentFromDraft: () => SavedDocument | null;
  handlePdfUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

function toImportDetails(
  result: PdfExtractionResult,
): PdfImportDetails {
  return {
    pageCount: result.pageCount,
    originalWordCount: result.wordCount,
    removedRepeatedLines: result.removedRepeatedLines,
    removedPageNumberLines: result.removedPageNumberLines,
    emptyPageCount: result.emptyPageCount,
    warnings: result.warnings,
  };
}

export function useDocumentImport(): UseDocumentImportResult {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [formError, setFormError] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfImportDetails, setPdfImportDetails] =
    useState<PdfImportDetails | null>(null);

  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const pastedWordCount = useMemo(
    () => tokenizeText(draftText).length,
    [draftText],
  );

  const updateDraftTitle = useCallback((value: string) => {
    setDraftTitle(value);
    setFormError("");
  }, []);

  const updateDraftText = useCallback((value: string) => {
    setDraftText(value);
    setFormError("");
  }, []);

  const clearFormError = useCallback(() => {
    setFormError("");
  }, []);

  const setImportError = useCallback((message: string) => {
    setFormError(message);
  }, []);

  const createDocumentFromDraft = useCallback(() => {
    const parsedWords = tokenizeText(draftText);

    if (parsedWords.length === 0) {
      setFormError("Paste some text before starting.");
      return null;
    }

    const title = draftTitle.trim() || "Untitled text";

    setFormError("");

    return createSavedDocument({
      title,
      text: draftText,
      wordCount: parsedWords.length,
      wordsPerMinute: DEFAULT_WPM,
      fontSize: DEFAULT_FONT_SIZE,
      useNaturalPauses: false,
    });
  }, [draftText, draftTitle]);

  const handlePdfUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

      if (!isPdf) {
        setFormError("Choose a valid PDF file.");
        setPdfFileName("");
        setPdfProgress(0);
        setPdfImportDetails(null);
        return;
      }

      if (file.size > MAX_PDF_FILE_SIZE) {
        setFormError("Choose a PDF smaller than 20 MB.");
        setPdfFileName("");
        setPdfProgress(0);
        setPdfImportDetails(null);
        return;
      }

      setIsExtractingPdf(true);
      setPdfProgress(0);
      setPdfFileName(file.name);
      setPdfImportDetails(null);
      setFormError("");

      try {
        const { extractTextFromPdf } = await import("../lib/pdf");
        const result = await extractTextFromPdf(
          file,
          (currentPage, totalPages) => {
            setPdfProgress(
              Math.round((currentPage / totalPages) * 100),
            );
          },
        );

        if (tokenizeText(result.text).length === 0) {
          throw new Error(
            "No selectable text was found. This PDF may contain only scanned images.",
          );
        }

        setDraftText(result.text);
        setDraftTitle((currentTitle) =>
          currentTitle.trim()
            ? currentTitle
            : file.name.replace(/\.pdf$/i, ""),
        );
        setPdfImportDetails(toImportDetails(result));
        setPdfProgress(100);
        setFormError("");
      } catch (error) {
        setPdfFileName("");
        setPdfProgress(0);
        setPdfImportDetails(null);
        setFormError(
          error instanceof Error
            ? error.message
            : "The PDF could not be processed.",
        );
      } finally {
        setIsExtractingPdf(false);
      }
    },
    [],
  );

  return {
    draftTitle,
    draftText,
    formError,
    pdfFileName,
    isExtractingPdf,
    pdfProgress,
    pdfImportDetails,
    pastedWordCount,
    pdfInputRef,
    updateDraftTitle,
    updateDraftText,
    clearFormError,
    setImportError,
    createDocumentFromDraft,
    handlePdfUpload,
  };
}
