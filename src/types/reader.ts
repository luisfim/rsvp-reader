export type Screen = "home" | "reader";

export interface ReaderOptions {
  documentId?: string | null;
  startIndex?: number;
  savedWordsPerMinute?: number;
  savedFontSize?: number;
  savedNaturalPauses?: boolean;
}

export interface ReaderSnapshot {
  activeDocumentId: string | null;
  currentWordIndex: number;
  wordsPerMinute: number;
  fontSize: number;
  useNaturalPauses: boolean;
}
