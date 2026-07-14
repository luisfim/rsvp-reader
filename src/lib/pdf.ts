import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ProgressCallback = (
  currentPage: number,
  totalPages: number,
) => void;

function normalizePageText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/(\p{L})-\s*\n\s*(\p{Ll})/gu, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractTextFromPdf(
  file: File,
  onProgress?: ProgressCallback,
): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });

  try {
    const pdf = await loadingTask.promise;
    const extractedPages: string[] = [];

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber += 1
    ) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageParts: string[] = [];

      for (const item of textContent.items) {
        if (!("str" in item)) {
          continue;
        }

        pageParts.push(item.str);
        pageParts.push(item.hasEOL ? "\n" : " ");
      }

      const pageText = normalizePageText(pageParts.join(""));

      if (pageText) {
        extractedPages.push(pageText);
      }

      onProgress?.(pageNumber, pdf.numPages);
    }

    return extractedPages.join("\n\n").trim();
  } catch (error) {
    if (error instanceof Error && /password/i.test(error.message)) {
      throw new Error(
        "This PDF is password-protected and cannot be opened.",
      );
    }

    throw new Error(
      "The PDF could not be read. Make sure it contains selectable text.",
    );
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // Ignore PDF worker cleanup errors.
    }
  }
}
