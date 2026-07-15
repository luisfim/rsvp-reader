export interface PdfLine {
  text: string;
  x: number;
  y: number;
  height: number;
}

export interface PdfPageLines {
  pageNumber: number;
  lines: PdfLine[];
}

export interface CleanedPdfPage {
  pageNumber: number;
  text: string;
}

const HEADER_FOOTER_ZONE_SIZE = 3;
const MAX_REPEAT_CANDIDATE_LENGTH = 140;
const MIN_REPEAT_PAGE_COUNT = 3;

export function normalizePdfWhitespace(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

function normalizeRepeatedLineKey(value: string): string {
  return normalizePdfWhitespace(value)
    .toLocaleLowerCase()
    .replace(/\d+/g, "#")
    .replace(/[“”"'‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulRepeatedLineCandidate(value: string): boolean {
  const normalized = normalizeRepeatedLineKey(value);

  return (
    normalized.length >= 3 &&
    normalized.length <= MAX_REPEAT_CANDIDATE_LENGTH &&
    /[\p{L}\p{N}]/u.test(normalized)
  );
}

export function isIsolatedPageNumber(value: string): boolean {
  const normalized = normalizePdfWhitespace(value);

  return /^(?:page\s+)?(?:\d{1,5}|[ivxlcdm]{1,10})(?:\s*(?:of|\/)\s*\d{1,5})?$/i.test(
    normalized,
  );
}

function getHeaderFooterIndexes(lineCount: number): Set<number> {
  const indexes = new Set<number>();
  const zoneSize = Math.min(HEADER_FOOTER_ZONE_SIZE, lineCount);

  for (let index = 0; index < zoneSize; index += 1) {
    indexes.add(index);
  }

  for (
    let index = Math.max(0, lineCount - zoneSize);
    index < lineCount;
    index += 1
  ) {
    indexes.add(index);
  }

  return indexes;
}

export function findRepeatedHeaderFooterKeys(
  pages: PdfPageLines[],
): Set<string> {
  const pagesByKey = new Map<string, Set<number>>();

  for (const page of pages) {
    const zoneIndexes = getHeaderFooterIndexes(page.lines.length);
    const keysOnPage = new Set<string>();

    for (const index of zoneIndexes) {
      const line = page.lines[index];

      if (!line || !isUsefulRepeatedLineCandidate(line.text)) {
        continue;
      }

      keysOnPage.add(normalizeRepeatedLineKey(line.text));
    }

    for (const key of keysOnPage) {
      const pageNumbers = pagesByKey.get(key) ?? new Set<number>();
      pageNumbers.add(page.pageNumber);
      pagesByKey.set(key, pageNumbers);
    }
  }

  const repeatThreshold = Math.max(
    MIN_REPEAT_PAGE_COUNT,
    Math.ceil(pages.length * 0.5),
  );

  return new Set(
    [...pagesByKey.entries()]
      .filter(([, pageNumbers]) => pageNumbers.size >= repeatThreshold)
      .map(([key]) => key),
  );
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (
      (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
    );
  }

  return sortedValues[middleIndex];
}

function startsWithLowercaseLetter(value: string): boolean {
  const firstLetter = value.match(/\p{L}/u)?.[0];

  return Boolean(
    firstLetter && firstLetter === firstLetter.toLocaleLowerCase(),
  );
}

function shouldJoinWithoutSpace(
  currentLine: string,
  nextLine: string,
): boolean {
  return /\p{L}-$/u.test(currentLine) && startsWithLowercaseLetter(nextLine);
}

export function mergePdfLinesIntoParagraphs(lines: PdfLine[]): string {
  if (lines.length === 0) {
    return "";
  }

  const positiveVerticalGaps: number[] = [];

  for (let index = 0; index < lines.length - 1; index += 1) {
    const currentLine = lines[index];
    const nextLine = lines[index + 1];
    const gap = Math.abs(currentLine.y - nextLine.y);

    if (gap > 0) {
      positiveVerticalGaps.push(gap);
    }
  }

  const typicalGap = median(positiveVerticalGaps);
  const paragraphGapThreshold =
    typicalGap > 0 ? typicalGap * 1.55 : Number.POSITIVE_INFINITY;

  const paragraphs: string[] = [];
  let currentParagraph = lines[0].text;

  for (let index = 0; index < lines.length - 1; index += 1) {
    const currentLine = lines[index];
    const nextLine = lines[index + 1];
    const verticalGap = Math.abs(currentLine.y - nextLine.y);
    const isParagraphGap = verticalGap > paragraphGapThreshold;

    if (isParagraphGap) {
      paragraphs.push(currentParagraph.trim());
      currentParagraph = nextLine.text;
      continue;
    }

    if (shouldJoinWithoutSpace(currentParagraph, nextLine.text)) {
      currentParagraph = `${currentParagraph.slice(0, -1)}${nextLine.text}`;
    } else {
      currentParagraph = `${currentParagraph} ${nextLine.text}`;
    }
  }

  paragraphs.push(currentParagraph.trim());

  return paragraphs
    .filter(Boolean)
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanPdfPageLines(
  page: PdfPageLines,
  repeatedKeys: Set<string>,
): {
  page: CleanedPdfPage;
  removedRepeatedLines: number;
  removedPageNumberLines: number;
} {
  const zoneIndexes = getHeaderFooterIndexes(page.lines.length);
  let removedRepeatedLines = 0;
  let removedPageNumberLines = 0;

  const remainingLines = page.lines.filter((line, index) => {
    const isInHeaderFooterZone = zoneIndexes.has(index);

    if (!isInHeaderFooterZone) {
      return true;
    }

    if (isIsolatedPageNumber(line.text)) {
      removedPageNumberLines += 1;
      return false;
    }

    if (repeatedKeys.has(normalizeRepeatedLineKey(line.text))) {
      removedRepeatedLines += 1;
      return false;
    }

    return true;
  });

  return {
    page: {
      pageNumber: page.pageNumber,
      text: mergePdfLinesIntoParagraphs(remainingLines),
    },
    removedRepeatedLines,
    removedPageNumberLines,
  };
}

export function joinCleanedPdfPages(pages: CleanedPdfPage[]): string {
  let combinedText = "";

  for (const page of pages) {
    const pageText = page.text.trim();

    if (!pageText) {
      continue;
    }

    if (!combinedText) {
      combinedText = pageText;
      continue;
    }

    const shouldReconnectWord =
      /\p{L}-$/u.test(combinedText) && startsWithLowercaseLetter(pageText);

    combinedText = shouldReconnectWord
      ? `${combinedText.slice(0, -1)}${pageText}`
      : `${combinedText}\n\n${pageText}`;
  }

  return combinedText
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
