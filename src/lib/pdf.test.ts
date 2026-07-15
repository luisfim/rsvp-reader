import { describe, expect, it } from "vitest";

import {
  findRepeatedHeaderFooterKeys,
  isIsolatedPageNumber,
  joinCleanedPdfPages,
} from "./pdfCleanup";

describe("PDF cleanup helpers", () => {
  it("recognizes common isolated page-number lines", () => {
    expect(isIsolatedPageNumber("12")).toBe(true);
    expect(isIsolatedPageNumber("Page 12")).toBe(true);
    expect(isIsolatedPageNumber("12 / 320")).toBe(true);
    expect(isIsolatedPageNumber("xiv")).toBe(true);
    expect(isIsolatedPageNumber("Chapter 12")).toBe(false);
    expect(isIsolatedPageNumber("The year 2026")).toBe(false);
  });

  it("detects repeated lines in page header and footer zones", () => {
    const repeatedKeys = findRepeatedHeaderFooterKeys([
      {
        pageNumber: 1,
        lines: [
          { text: "Quiet Focus", x: 10, y: 800, height: 12 },
          { text: "First body line", x: 10, y: 700, height: 12 },
          { text: "1", x: 300, y: 20, height: 12 },
        ],
      },
      {
        pageNumber: 2,
        lines: [
          { text: "Quiet Focus", x: 10, y: 800, height: 12 },
          { text: "Second body line", x: 10, y: 700, height: 12 },
          { text: "2", x: 300, y: 20, height: 12 },
        ],
      },
      {
        pageNumber: 3,
        lines: [
          { text: "Quiet Focus", x: 10, y: 800, height: 12 },
          { text: "Third body line", x: 10, y: 700, height: 12 },
          { text: "3", x: 300, y: 20, height: 12 },
        ],
      },
    ]);

    expect(repeatedKeys.has("quiet focus")).toBe(true);
  });

  it("reconnects words split by a hyphen across pages", () => {
    expect(
      joinCleanedPdfPages([
        { pageNumber: 1, text: "This is an inter-" },
        { pageNumber: 2, text: "esting example." },
      ]),
    ).toBe("This is an interesting example.");
  });

  it("keeps normal page boundaries as paragraph breaks", () => {
    expect(
      joinCleanedPdfPages([
        { pageNumber: 1, text: "First paragraph." },
        { pageNumber: 2, text: "Second paragraph." },
      ]),
    ).toBe("First paragraph.\n\nSecond paragraph.");
  });
});
