import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("uses the Fixpoint horizontal light asset by default", () => {
    render(<BrandLogo />);

    expect(screen.getByRole("img", { name: "Fixpoint" })).toHaveAttribute(
      "src",
      "/branding/logo-horizontal-light.svg",
    );
  });

  it("supports decorative standalone symbols", () => {
    const { container } = render(
      <BrandLogo variant="symbol" tone="dark" decorative />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/branding/symbol-dark.svg");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("aria-hidden", "true");
  });
});
