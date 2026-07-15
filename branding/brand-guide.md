# Fixpoint Brand Guide

## Brand

**Name:** Fixpoint  
**Primary tagline:** Read faster. Stay centered.  
**Secondary phrase:** A fixed point. Total focus.

Fixpoint is a minimalist RSVP speed-reading application. Its symbol represents a
stable visual anchor: words move, while the reader's focal point remains fixed.

## Color palette

| Role | Color | Hex |
|---|---|---|
| Primary background and dark logo | Dark navy | `#0D1B2A` |
| Light text and light logo | White | `#FFFFFF` |
| Fixation-point accent | Muted old red | `#B64545` |
| Supporting interface text | Blue-gray | `#64748B` |

The muted red is an accent. Reserve it primarily for the central fixation point,
the red dots in the wordmark, and small high-value brand details.

## Logo variants

- `logo-horizontal-dark.svg`: use on white or light backgrounds.
- `logo-horizontal-light.svg`: use on navy, black, or dark backgrounds.
- `logo-stacked-dark.svg`: compact lockup for light backgrounds.
- `logo-stacked-light.svg`: compact lockup for dark backgrounds.
- `symbol-dark.svg`: standalone mark for light backgrounds.
- `symbol-light.svg`: standalone mark for dark backgrounds.
- `symbol-monochrome-black.svg`: single-color black production variant.
- `symbol-monochrome-white.svg`: single-color white production variant.

The SVG wordmarks use embedded vector paths. They do not depend on a font being
installed and do not contain or distribute a font file.

## Clear space

Maintain clear space around the logo equal to at least the diameter of the
central red dot. Do not place text, borders, icons, or other visual elements
inside this area.

## Minimum digital sizes

- Horizontal logo: 140 px wide.
- Stacked logo: 100 px wide.
- Standalone symbol: 24 px.
- Use the dedicated raster favicon files below 24 px.

## Icon files

- `app-icon-1024.png`: master square app-store artwork.
- `apple-touch-icon-180.png`: Apple touch icon.
- `pwa-icon-192.png` and `pwa-icon-512.png`: standard PWA icons.
- `pwa-maskable-192.png` and `pwa-maskable-512.png`: maskable PWA icons with
  additional safe-zone padding.
- `favicon-16.png`, `favicon-32.png`, and `favicon-48.png`: browser favicon PNGs.
- `favicon.ico`: multi-size ICO containing 16, 32, and 48 px versions.
- `favicon.svg`: scalable modern-browser favicon.
- `app-icon.svg`: scalable source version of the application icon.

The store and PWA PNGs use full-bleed opaque navy backgrounds. Platform masks
can apply rounded corners or circles without exposing transparent edges.

## Browser integration

```html
<link rel="icon" href="/branding/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/branding/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/branding/favicon-16.png" sizes="16x16" type="image/png">
<link rel="shortcut icon" href="/branding/favicon.ico">
<link rel="apple-touch-icon" href="/branding/apple-touch-icon-180.png">
<meta name="theme-color" content="#0D1B2A">
```

Use `manifest-snippet.json` as a reference when updating the PWA manifest.

## Usage rules

### Do

- Preserve the logo proportions.
- Keep the fixation point centered.
- Use the light logo on dark surfaces and the dark logo on light surfaces.
- Keep reader text white and the fixation character muted red.
- Use the standalone symbol for compact headers, loading states, and app icons.

### Do not

- Recolor the fixation point with bright red or unrelated accent colors.
- Stretch, rotate, outline, or add effects to the logo.
- Place the full wordmark close to the moving RSVP word.
- Add eyes, books, brains, flames, lightning, speedometers, or other generic
  speed-reading imagery.
- Add drop shadows to the vector logo files.

## Reader interface hierarchy

The reader itself should remain quieter than the surrounding application:

- very dark navy or black reading surface;
- white reading text;
- muted-red fixation character;
- blue controls;
- no full wordmark beside the moving word.

## Included production extras

- `brand-tokens.css`: CSS variables for the official palette.
- `manifest-snippet.json`: PWA manifest icon configuration.
