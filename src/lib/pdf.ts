import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import {
  cleanPdfPageLines,
  findRepeatedHeaderFooterKeys,
  joinCleanedPdfPages,
  normalizePdfWhitespace,
  type PdfLine,
  type PdfPageLines,
} from "./pdfCleanup";
import { tokenizeText } from "./reader";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PdfExtractionProgressCallback = (
  currentPage: number,
  totalPages: number,
) => void;

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  wordCount: number;
  emptyPageCount: number;
  removedRepeatedLines: number;
  removedPageNumberLines: number;
  warnings: string[];
}

function getTextItemPosition(item: {
  transform?: number[];
  height?: number;
}) {
  const transform = item.transform ?? [];

  return {
    x: Number.isFinite(transform[4]) ? transform[4] : 0,
    y: Number.isFinite(transform[5]) ? transform[5] : 0,
    height:
      typeof item.height === "number" && Number.isFinite(item.height)
        ? Math.max(item.height, 1)
        : 12,
  };
}

function buildPageLines(items: unknown[]): PdfLine[] {
  const lines: PdfLine[] = [];
  let currentText = "";
  let currentX = 0;
  let currentY = 0;
  let currentHeight = 12;
  let hasCurrentLine = false;

  const flushCurrentLine = () => {
    const normalized = normalizePdfWhitespace(currentText);

    if (normalized) {
      lines.push({
        text: normalized,
        x: currentX,
        y: currentY,
        height: currentHeight,
      });
    }

    currentText = "";
    hasCurrentLine = false;
  };

  for (const rawItem of items) {
    if (
      typeof rawItem !== "object" ||
      rawItem === null ||
      !("str" in rawItem) ||
      typeof rawItem.str !== "string"
    ) {
      continue;
    }

    const item = rawItem as {
      str: string;
      hasEOL?: boolean;
      transform?: number[];
      height?: number;
    };

    const itemText = normalizePdfWhitespace(item.str);
    const position = getTextItemPosition(item);

    if (!itemText) {
      if (item.hasEOL) {
        flushCurrentLine();
      }

      continue;
    }

    const startsNewGeometricLine =
      hasCurrentLine &&
      Math.abs(position.y - currentY) >
        Math.max(position.height, currentHeight) * 0.55;

    if (startsNewGeometricLine) {
      flushCurrentLine();
    }

    if (!hasCurrentLine) {
      currentX = position.x;
      currentY = position.y;
      currentHeight = position.height;
      hasCurrentLine = true;
    }

    const needsSpace =
      currentText.length > 0 &&
      !/[-–—/]$/.test(currentText) &&
      !/^[,.;:!?%\])}]/.test(itemText);

    currentText += `${needsSpace ? " " : ""}${itemText}`;
    currentHeight = Math.max(currentHeight, position.height);

    if (item.hasEOL) {
      flushCurrentLine();
    }
  }

  flushCurrentLine();

  return lines;
}

function getFriendlyPdfError(error: unknown): Error {
  const errorName =
    typeof error === "object" && error !== null && "name" in error
      ? String(error.name)
      : "";

  const errorMessage =
    error instanceof Error ? error.message : String(error ?? "");

  if (
    errorName === "PasswordException" ||
    /password/i.test(errorMessage)
  ) {
    return new Error(
      "This PDF is password-protected. Remove the password and try again.",
    );
  }

  if (
    errorName === "InvalidPDFException" ||
    /invalid pdf|malformed|corrupt/i.test(errorMessage)
  ) {
    return new Error(
      "This PDF appears to be damaged or malformed and could not be read.",
    );
  }

  if (errorName === "MissingPDFException") {
    return new Error("The selected PDF could not be found or opened.");
  }

  if (errorName === "UnexpectedResponseException") {
    return new Error(
      "The PDF could not be loaded because the file response was invalid.",
    );
  }

  return new Error(
    "The PDF could not be read. Try another file or paste the text manually.",
  );
}

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

export async function extractTextFromPdf(
  file: File,
  onProgress?: PdfExtractionProgressCallback,
): Promise<PdfExtractionResult> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });

  try {
    const pdf = await loadingTask.promise;
    const extractedPages: PdfPageLines[] = [];
    let emptyPageCount = 0;

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber += 1
    ) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent({
        disableNormalization: false,
        includeMarkedContent: false,
      });

      const lines = buildPageLines(textContent.items);

      if (lines.length === 0) {
        emptyPageCount += 1;
      }

      extractedPages.push({ pageNumber, lines });
      onProgress?.(pageNumber, pdf.numPages);

      if (pageNumber % 2 === 0) {
        await yieldToBrowser();
      }
    }

    const repeatedHeaderFooterKeys =
      findRepeatedHeaderFooterKeys(extractedPages);

    let removedRepeatedLines = 0;
    let removedPageNumberLines = 0;

    const cleanedPages = extractedPages.map((page) => {
      const cleanedPage = cleanPdfPageLines(
        page,
        repeatedHeaderFooterKeys,
      );
      removedRepeatedLines += cleanedPage.removedRepeatedLines;
      removedPageNumberLines += cleanedPage.removedPageNumberLines;
      return cleanedPage.page;
    });

    const text = joinCleanedPdfPages(cleanedPages);
    const wordCount = tokenizeText(text).length;

    if (wordCount === 0) {
      throw new Error(
        "No selectable text was found. This PDF may contain only scanned images.",
      );
    }

    const warnings: string[] = [];

    if (emptyPageCount > 0) {
      warnings.push(
        `${emptyPageCount} ${
          emptyPageCount === 1 ? "page contains" : "pages contain"
        } no selectable text.`,
      );
    }

    if (wordCount < Math.max(20, pdf.numPages * 5)) {
      warnings.push(
        "Very little text was detected. Review the result because this may be a scanned or image-heavy PDF.",
      );
    }

    if (pdf.numPages >= 150) {
      warnings.push(
        "This is a large document. Review chapter breaks and formatting before starting.",
      );
    }

    return {
      text,
      pageCount: pdf.numPages,
      wordCount,
      emptyPageCount,
      removedRepeatedLines,
      removedPageNumberLines,
      warnings,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      /No selectable text was found/.test(error.message)
    ) {
      throw error;
    }

    throw getFriendlyPdfError(error);
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // Ignore PDF worker cleanup errors.
    }
  }
}
