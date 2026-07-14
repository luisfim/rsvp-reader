import { describe, expect, it } from "vitest";
import {
  getFocusLetterIndex,
  getWordDelay,
  tokenizeText,
} from "./reader";

describe("tokenizeText", () => {
  it("splits spaces, tabs, and line breaks", () => {
    expect(tokenizeText("  Read\nwith\tsteady   focus.  ")).toEqual([
      "Read",
      "with",
      "steady",
      "focus.",
    ]);
  });

  it("returns an empty list for blank input", () => {
    expect(tokenizeText("  \n\t  ")).toEqual([]);
  });
});

describe("getFocusLetterIndex", () => {
  it("places the fixation point near the optimal recognition position", () => {
    expect(getFocusLetterIndex("reading")).toBe(2);
    expect("reading"[getFocusLetterIndex("reading")]).toBe("a");
  });

  it("ignores opening punctuation when calculating the letter", () => {
    const word = '"focus"';
    expect(word[getFocusLetterIndex(word)]).toBe("o");
  });

  it("returns a safe index for punctuation-only tokens", () => {
    expect(getFocusLetterIndex("...")).toBe(1);
  });
});

describe("getWordDelay", () => {
  it("uses the exact WPM interval when natural pauses are disabled", () => {
    expect(getWordDelay("word", 400, false)).toBe(150);
  });

  it("adds a shorter pause after commas", () => {
    expect(getWordDelay("word,", 400, true)).toBeCloseTo(217.5);
  });

  it("adds a longer pause after sentence-ending punctuation", () => {
    expect(getWordDelay("word.", 400, true)).toBeCloseTo(315);
  });

  it("adds time for long words", () => {
    expect(getWordDelay("extraordinary", 400, true)).toBeCloseTo(217.5);
  });
});
