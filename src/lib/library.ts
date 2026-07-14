const LIBRARY_STORAGE_KEY = "rsvp-reader-library-v1";

export interface SavedDocument {
  id: string;
  title: string;
  text: string;
  wordCount: number;
  currentWordIndex: number;
  wordsPerMinute: number;
  fontSize: number;
  useNaturalPauses: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateDocumentInput {
  title: string;
  text: string;
  wordCount: number;
  wordsPerMinute: number;
  fontSize: number;
  useNaturalPauses: boolean;
}

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function parseStoredDocument(value: unknown): SavedDocument | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    !("title" in value) ||
    !("text" in value)
  ) {
    return null;
  }

  const storedDocument = value as Partial<SavedDocument>;

  if (
    typeof storedDocument.id !== "string" ||
    typeof storedDocument.title !== "string" ||
    typeof storedDocument.text !== "string"
  ) {
    return null;
  }

  const wordCount =
    typeof storedDocument.wordCount === "number"
      ? Math.max(0, storedDocument.wordCount)
      : countWords(storedDocument.text);

  const currentWordIndex =
    typeof storedDocument.currentWordIndex === "number"
      ? Math.min(
          Math.max(Math.trunc(storedDocument.currentWordIndex), 0),
          Math.max(wordCount - 1, 0),
        )
      : 0;

  return {
    id: storedDocument.id,
    title: storedDocument.title,
    text: storedDocument.text,
    wordCount,
    currentWordIndex,
    wordsPerMinute:
      typeof storedDocument.wordsPerMinute === "number"
        ? Math.min(
            Math.max(Math.trunc(storedDocument.wordsPerMinute), 250),
            2000,
          )
        : 400,
    fontSize:
      typeof storedDocument.fontSize === "number"
        ? Math.min(Math.max(Math.trunc(storedDocument.fontSize), 48), 112)
        : 72,
    useNaturalPauses:
      typeof storedDocument.useNaturalPauses === "boolean"
        ? storedDocument.useNaturalPauses
        : false,
    createdAt:
      typeof storedDocument.createdAt === "string"
        ? storedDocument.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof storedDocument.updatedAt === "string"
        ? storedDocument.updatedAt
        : new Date().toISOString(),
  };
}

export function createSavedDocument(
  input: CreateDocumentInput,
): SavedDocument {
  const currentDate = new Date().toISOString();

  return {
    id: createId(),
    title: input.title,
    text: input.text,
    wordCount: input.wordCount,
    currentWordIndex: 0,
    wordsPerMinute: input.wordsPerMinute,
    fontSize: input.fontSize,
    useNaturalPauses: input.useNaturalPauses,
    createdAt: currentDate,
    updatedAt: currentDate,
  };
}

export function loadSavedDocuments(): SavedDocument[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(LIBRARY_STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map(parseStoredDocument)
      .filter(
        (document): document is SavedDocument => document !== null,
      )
      .sort(
        (firstDocument, secondDocument) =>
          new Date(secondDocument.updatedAt).getTime() -
          new Date(firstDocument.updatedAt).getTime(),
      );
  } catch {
    return [];
  }
}

export function persistSavedDocuments(
  documents: SavedDocument[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    LIBRARY_STORAGE_KEY,
    JSON.stringify(documents),
  );
}
