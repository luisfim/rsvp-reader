import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useOnboarding } from "./useOnboarding";

beforeEach(() => {
  localStorage.clear();
});

describe("useOnboarding", () => {
  it("opens automatically for a first-time visitor", () => {
    const { result } = renderHook(() => useOnboarding());

    expect(result.current.isHelpOpen).toBe(true);
  });

  it("remembers when onboarding has been dismissed", () => {
    const firstVisit = renderHook(() => useOnboarding());

    act(() => {
      firstVisit.result.current.closeHelp();
    });

    expect(firstVisit.result.current.isHelpOpen).toBe(false);

    firstVisit.unmount();

    const returningVisit = renderHook(() => useOnboarding());
    expect(returningVisit.result.current.isHelpOpen).toBe(false);
  });

  it("can be opened again from the help button", () => {
    localStorage.setItem("rsvp-reader-onboarding-v1", "completed");
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.openHelp();
    });

    expect(result.current.isHelpOpen).toBe(true);
  });
});
