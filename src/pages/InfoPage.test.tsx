import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import {
  getInfoPageFromPath,
  InfoPage,
} from "./InfoPage";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

describe("getInfoPageFromPath", () => {
  it("recognizes all public information routes", () => {
    expect(getInfoPageFromPath("/privacy")).toBe("privacy");
    expect(getInfoPageFromPath("/terms/")).toBe("terms");
    expect(getInfoPageFromPath("/about")).toBe("about");
    expect(getInfoPageFromPath("/support")).toBe("support");
    expect(getInfoPageFromPath("/library")).toBeNull();
  });
});

describe("InfoPage", () => {
  it("renders the privacy policy and information navigation", () => {
    render(
      <MemoryRouter>
        <InfoPage
          page="privacy"
          accountLabel="Sign in"
          cloudConnectionLabel={null}
          cloudConnectionStatus="online"
          isOnline
          savedDocumentCount={0}
          onNavigateHome={() => undefined}
          onOpenLibrary={() => undefined}
          onOpenAccount={() => undefined}
          onOpenHelp={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Terms" })[0],
    ).toHaveAttribute("href", "/terms");
    expect(
      screen.getByText(/PDF text extraction runs in your browser/i),
    ).toBeInTheDocument();
  });
});
