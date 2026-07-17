# RSVP Reader — latest replacement files

Replace the matching files in your existing Vite project:

- `src/App.tsx`
- `src/App.css`
- `src/index.css`
- `src/main.tsx`
- `src/lib/library.ts`
- `src/lib/pdf.ts`

Make sure PDF.js is installed:

```bash
npm install pdfjs-dist
```

Run the development server:

```bash
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

Verify the production build:

```bash
npm run build
```

## Included in this version

- 250–2,000 WPM, changing in 25 WPM steps
- Mouse, arrow-key, WASD and Space controls
- Optional natural pauses
- Open Sans interface
- PDF text extraction
- Local document library
- Autosave approximately once per second during playback
- Immediate save when paused or exited
- Save on page hide, tab switch and refresh
- Saved word index, WPM, font size and natural-pause preference
- Continue, restart and delete actions
- Background line tracking near the top of the reader 
-
