import { describe, expect, it } from "vitest";
import {
  DEFAULT_WPM,
  MAX_FONT_SIZE,
  MAX_WPM,
  MIN_FONT_SIZE,
  MIN_WPM,
  WPM_STEP,
} from "./reader";

describe("reader configuration", () => {
  it("keeps the agreed speed range and increment", () => {
    expect(MIN_WPM).toBe(250);
    expect(MAX_WPM).toBe(2000);
    expect(WPM_STEP).toBe(25);
    expect(DEFAULT_WPM).toBeGreaterThanOrEqual(MIN_WPM);
    expect(DEFAULT_WPM).toBeLessThanOrEqual(MAX_WPM);
  });

  it("keeps a valid font-size range", () => {
    expect(MIN_FONT_SIZE).toBeLessThan(MAX_FONT_SIZE);
  });
});
