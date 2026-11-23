# Font Viewer

Drop a font and see it rendered the way Gamzix slot games render it: PixiJS 7.4.3 `BitmapText` for bitmap fonts,
Pixi `Text` for web fonts. Built for artists and developers to check every glyph before a font goes into a game.

## Run

Needs Node 22+. Only public npm packages, no `@gamzix` registry access required.

```bash
npm install
npm run dev          # http://localhost:8082
npm run build        # static site in dist/ (relative paths, can be hosted from any folder)
npm run preview      # serve dist/
```

Checks: `npm run type-check`, `npm run lint`, `npm run test`.

## Deploy

`.github/workflows/deploy.yml` checks and builds every push to `main` and publishes `dist/` to GitHub Pages. One-time
setup in the GitHub repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Dropped fonts never leave the browser: the page makes no network requests with them.

## What you can drop

Drop files or whole folders anywhere on the page, or use **Open files…** / **Open folder…**. Nested folders are read.
When a drop contains a `fonts` or `webfonts` folder, only files inside such folders are read, so dropping a whole
`public/` folder works.

| Input | Example | How it is read |
| --- | --- | --- |
| Folder of glyph PNGs (raw art) | `public/raw/fonts/bitmap/numbers/0.png`, `dot.png` | One font per folder, named after the folder |
| Built atlas | `public/assets/fonts/bitmap/numbers/numbers_1080p.json` + image | One font per name, every resolution found (`_1080p`, `_720p`, `_540p`) |
| BMFont | `.fnt` / `.xml` (XML or text format) + page PNGs | Pages matched by `<page file>` name |
| Web font | `.ttf`, `.otf`, `.woff`, `.woff2` | Loaded with `FontFace`, rendered with Pixi `Text` |

Reloading the same folder replaces the fonts loaded from it. A file that fails to load shows a message and leaves the
fonts already loaded untouched.

## How a glyph folder becomes a font in the game

The viewer repeats the game pipeline step by step:

1. **assets-builder** (`@gamzix/assets-builder` 0.2.0) packs the folder without trimming or rotation and renames
   frames with `fontCharMap`: `dot . comma , usd $ eur € space ␠ dash - minus - plus + slash /`. Other names stay as
   they are, case kept. The 720p atlas is every glyph scaled by 0.75 and rounded to whole pixels.
2. **fe-sdk** (`BitmapLoaderBehaviour`, same code in hemi-pixi) builds a `BitmapFont` from the frames: one page per
   glyph, `xoffset = yoffset = 0`, `xadvance` = frame width, `size` and `lineHeight` = height of the first frame
   (`Object.keys` order, so digits come first). A frame name longer than one character must be one of
   `dot comma usd eur space dash plus`, otherwise the game throws while loading the fonts bundle.
3. The game draws it with `new BitmapText(text, { fontName, fontSize, align, letterSpacing, maxWidth, tint })`;
   **scaleToWidth** shrinks the text like `BitmapValueComponent`.

So the PNG canvas of a glyph is its box in the text: transparent columns are spacing, transparent rows move the glyph
up or down.

## Checks

Shown in the font list, on the glyph cards and in the **Problems** tab:

- glyph name without a character (the game crashes on load), e.g. `Coma.png`, `x_big.png`;
- two files that end up as the same character (`dash.png` and `minus.png`);
- glyph heights that differ from the first glyph;
- digits of different widths (win counters jitter);
- digits standing on different baselines (more than 4% of the height apart);
- fully transparent glyphs, trimmed or rotated atlas frames;
- mixed letter case (`K` and `m`) and a missing space glyph.

The **Text** panel lists every character of the sample text that the font does not have and marks it in the text.
Presets cover win amounts, every glyph of the font, digits and punctuation, Latin, Latin extended, Cyrillic
(UA/BG/RU), Greek, Turkish, Vietnamese and currency symbols.

## Inspecting

- **Preview**: hover a glyph to see its character, code point and size. Guides: text box and width limits, line
  height, baseline (BMFont `base`, or the common bottom of the digit ink for glyph fonts), glyph boxes.
- **Glyphs** tab: every glyph at the same scale with its canvas, ink bounds and baseline; click one for its numbers.
- **Atlas** tab (atlas and BMFont): the page with glyph rectangles; hover for `x y w h`, offsets and advance.
- **Metrics** tab: size, line height, base, pages, resolutions, kerning pairs.
- **Compare**: renders a second font under the first with the same text and settings.
- **Asset resolution**: 1080p / 720p for glyph folders, every dropped resolution for atlases.
- **Export PNG** saves the preview; **Copy link with text** puts the sample text into the URL (`?text=`).

Settings are kept in `localStorage`. `?debug=1` exposes `window.fontViewerDebug.snapshot()` with the installed
fonts, font faces and object URLs (used to check that reloads do not leak).

## Known differences from the game

- 720p for a glyph folder is scaled in the browser (high-quality smoothing); assets-builder uses sharp with the
  `mitchell` kernel, so edges can differ slightly. Load the built `_720p` atlas for the exact pixels.
- For a glyph folder the frame order of the future atlas is not known, files are taken in name order. It only
  matters when glyph heights differ, which the checks already report.
- A game can override `fontCharMap` in its assets-builder config; the viewer uses the default map.
- BMFont and web fonts render with plain Pixi, without any engine text component on top.

## Code map

```
src/core/       pure functions, unit-tested: file classification, BMFont parser, atlas JSON, glyph names, checks, coverage
src/services/   browser side: reading drops, image decoding and ink bounds, font loading, registry (install/uninstall, object URLs)
src/renderer/   PreviewRenderer: owns every Pixi object, renders on demand
src/store/      one reactive store with settings and loaded fonts; UI and renderer read it
src/components/ Vue UI panel, styles in src/styles/main.css
```
