type BrandLogoVariant = "horizontal" | "stacked" | "symbol";
type BrandLogoTone = "light" | "dark";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  tone?: BrandLogoTone;
  className?: string;
  decorative?: boolean;
}

const LOGO_FILES: Record<
  BrandLogoVariant,
  Record<BrandLogoTone, string>
> = {
  horizontal: {
    light: "logo-horizontal-light.svg",
    dark: "logo-horizontal-dark.svg",
  },
  stacked: {
    light: "logo-stacked-light.svg",
    dark: "logo-stacked-dark.svg",
  },
  symbol: {
    light: "symbol-light.svg",
    dark: "symbol-dark.svg",
  },
};

export function BrandLogo({
  variant = "horizontal",
  tone = "light",
  className = "",
  decorative = false,
}: BrandLogoProps) {
  const filename = LOGO_FILES[variant][tone];
  const classes = ["brand-logo-asset", className]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      className={classes}
      src={`${import.meta.env.BASE_URL}branding/${filename}`}
      alt={decorative ? "" : "Fixpoint"}
      aria-hidden={decorative || undefined}
      draggable={false}
    />
  );
}
