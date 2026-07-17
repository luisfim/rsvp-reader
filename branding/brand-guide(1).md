# Fixpoint Brand Guide — Target O System

## Brand direction

Fixpoint uses a **wordmark-first identity**. The letter **O** is the single focal
element in the system: it becomes a restrained target with a muted-red center
point and four short alignment ticks.

There is no separate organic symbol. The app icon and favicon are derived from
the same target-O treatment used inside the wordmark.

## Brand statements

**Name:** Fixpoint  
**Primary tagline:** Read faster. Stay centered.  
**Secondary phrase:** One point. Total focus.

## Color palette

| Role | Color | Hex |
|---|---|---|
| Primary background and dark wordmark | Dark navy | `#0E1A2B` |
| Light text and light wordmark | White | `#FFFFFF` |
| Central fixation point | Muted red | `#C43D3D` |
| Supporting interface text | Blue-gray | `#64748B` |

The red is reserved for the center point and small high-value accents. Do not
add red dots above the letter I or elsewhere in the wordmark.

## Wordmark files

- `logo-horizontal-dark.svg`: primary wordmark for light backgrounds.
- `logo-horizontal-light.svg`: primary wordmark for dark backgrounds.
- `logo-horizontal-monochrome-black.svg`: black single-color version.
- `logo-horizontal-monochrome-white.svg`: white single-color version.
- `logo-stacked-dark.svg`: stacked wordmark for light backgrounds.
- `logo-stacked-light.svg`: stacked wordmark for dark backgrounds.

The wordmarks use embedded vector paths and do not depend on a font file.

## Target-O files

- `target-o.svg`: primary scalable target-O mark.
- `symbol-dark.svg`: target-O for light backgrounds.
- `symbol-light.svg`: target-O for dark backgrounds.
- `symbol-monochrome-black.svg`: black single-color mark.
- `symbol-monochrome-white.svg`: white single-color mark.

The `symbol-*` filenames intentionally match the previous Fixpoint asset system,
making replacement in the existing React application straightforward.

## Icon files

- `app-icon-1024.png`: master app-store icon.
- `app-icon.svg`: scalable dark-background app icon.
- `app-icon-light.svg`: scalable light-background app icon.
- `app-icon-light-512.png`: raster light icon reference.
- `apple-touch-icon-180.png`: Apple touch icon.
- `pwa-icon-192.png` and `pwa-icon-512.png`: standard PWA icons.
- `pwa-maskable-192.png` and `pwa-maskable-512.png`: maskable PWA icons with
  additional safe-zone padding.
- `favicon-16.png`, `favicon-32.png`, `favicon-48.png`: browser favicon PNGs.
- `favicon.ico`: multi-size browser favicon.
- `favicon.svg`: scalable favicon for modern browsers.

## Clear space

Keep clear space around the wordmark equal to at least the diameter of the red
center point. Do not allow text, borders, or interface controls to touch the
target ticks around the O.

## Minimum digital sizes

- Horizontal wordmark: 150 px wide.
- Stacked wordmark: 110 px wide.
- Target-O mark: 24 px.
- Use the dedicated favicon assets below 24 px.

## Browser integration

```html
<link rel="icon" href="/branding/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/branding/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/branding/favicon-16.png" sizes="16x16" type="image/png">
<link rel="shortcut icon" href="/branding/favicon.ico">
<link rel="apple-touch-icon" href="/branding/apple-touch-icon-180.png">
<meta name="theme-color" content="#0E1A2B">
```

## Usage rules

### Do

- Keep the O as the only special letter.
- Keep the red point perfectly centered inside the O.
- Preserve the four short focus ticks.
- Use the dark wordmark on light backgrounds and the light wordmark on dark
  backgrounds.
- Use the target-O alone for favicons, app icons, loading states, and compact
  headers.

### Do not

- Add a red dot above either I.
- Turn the target ticks into a large military-style crosshair.
- Add organic or mirrored curved symbols.
- Stretch, rotate, outline, or apply effects to the wordmark.
- Add unrelated reading imagery such as eyes, books, brains, or speedometers.

## Reader hierarchy

Inside the RSVP reader:

- dark navy or black reading surface;
- white reading text;
- muted-red fixation character;
- restrained blue controls;
- no large logo beside the moving word.

## Implementation extras

- `brand-tokens.css`: official CSS variables.
- `manifest-snippet.json`: PWA icon configuration reference.
