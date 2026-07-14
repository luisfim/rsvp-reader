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
import { extractTextFromPdf } from "../lib/pdf";
import { tokenizeText } from "../lib/reader";

interface UseDocumentImportResult {
  draftTitle: string;
  draftText: string;
  formError: string;
  pdfFileName: string;
  isExtractingPdf: boolean;
  pdfProgress: number;
  pastedWordCount: number;
  pdfInputRef: React.RefObject<HTMLInputElement | null>;
  updateDraftTitle: (value: string) => void;
  updateDraftText: (value: string) => void;
  clearFormError: () => void;
  setImportError: (message: string) => void;
  createDocumentFromDraft: () => SavedDocument | null;
  handlePdfUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function useDocumentImport(): UseDocumentImportResult {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [formError, setFormError] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

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
        return;
      }

      if (file.size > MAX_PDF_FILE_SIZE) {
        setFormError("Choose a PDF smaller than 20 MB.");
        setPdfFileName("");
        setPdfProgress(0);
        return;
      }

      setIsExtractingPdf(true);
      setPdfProgress(0);
      setPdfFileName(file.name);
      setFormError("");

      try {
        const extractedText = await extractTextFromPdf(
          file,
          (currentPage, totalPages) => {
            setPdfProgress(
              Math.round((currentPage / totalPages) * 100),
            );
          },
        );

        if (tokenizeText(extractedText).length === 0) {
          throw new Error(
            "No selectable text was found. This may be a scanned PDF.",
          );
        }

        setDraftText(extractedText);
        setDraftTitle((currentTitle) =>
          currentTitle.trim()
            ? currentTitle
            : file.name.replace(/\.pdf$/i, ""),
        );
        setPdfProgress(100);
        setFormError("");
      } catch (error) {
        setPdfFileName("");
        setPdfProgress(0);
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
