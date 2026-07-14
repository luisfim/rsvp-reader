export function tokenizeText(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function getFocusLetterIndex(word: string): number {
  const cleanWord = word.replace(
    /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
    "",
  );

  if (!cleanWord) {
    return Math.max(0, Math.floor((word.length - 1) / 2));
  }

  const cleanWordStart = word.indexOf(cleanWord);
  let focusPosition: number;

  if (cleanWord.length <= 1) {
    focusPosition = 0;
  } else if (cleanWord.length <= 5) {
    focusPosition = 1;
  } else if (cleanWord.length <= 9) {
    focusPosition = 2;
  } else if (cleanWord.length <= 13) {
    focusPosition = 3;
  } else {
    focusPosition = 4;
  }

  return cleanWordStart + Math.min(focusPosition, cleanWord.length - 1);
}

export function getWordDelay(
  word: string,
  wordsPerMinute: number,
  useNaturalPauses: boolean,
): number {
  const baseDelay = 60_000 / wordsPerMinute;

  if (!useNaturalPauses) {
    return baseDelay;
  }

  let multiplier = 1;

  const cleanWord = word.replace(
    /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
    "",
  );

  const wordLength = Array.from(cleanWord).length;

  if (wordLength >= 13) {
    multiplier += 0.45;
  } else if (wordLength >= 9) {
    multiplier += 0.25;
  }

  if (/[.!?]["')\]]?$/.test(word)) {
    multiplier += 1.1;
  } else if (/[,;:]["')\]]?$/.test(word)) {
    multiplier += 0.45;
  }

  return baseDelay * multiplier;
}
