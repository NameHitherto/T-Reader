---
name: t-reader-style-system
description: Implement, refactor, or review T-Reader frontend styling using the repository's current SCSS theme system. Use when changing theme tokens, global style entrypoints, reader styling, component SCSS, dialog/titlebar/common styles, or visual consistency rules; especially when work must preserve the token-driven light/dark theme model and the split between global SCSS and runtime reader style services.
---

# T-Reader Style System

## Overview

Follow this skill when editing frontend styles in T-Reader.

Treat styling as a token-first SCSS system with two layers:

- global SCSS loaded through `src/styles/index.scss`
- runtime reader style application handled by `src/services/theme/themeService.ts` and `src/services/reader/readerStyleService.ts`

## Start Here

Read these files before making non-trivial style changes:

1. `src/styles/index.scss`
2. `src/styles/theme/tokens.scss`
3. `src/styles/global/base.scss`
4. `src/services/theme/themeService.ts`
5. `src/services/reader/readerStyleService.ts`

Then read any relevant common style file:

- dialogs: `src/styles/common/dialogs.scss`
- titlebar: `src/styles/common/titlebar.scss`
- shared component shell styles: `src/styles/common/components.scss`

If the change is reader-only, also inspect:

- `src/services/reader/epub/epubStyleService.ts`
- `src/services/reader/txt/txtStyleService.ts`
- `src/ReaderApp.vue`

## Style Architecture

Keep this structure intact:

- `styles/theme/tokens.scss`: design tokens and light/dark CSS variables
- `styles/global/*`: reset and base rules
- `styles/vendors/*`: vendor overrides
- `styles/common/*`: reusable app-wide visual patterns
- component `.vue` files: local, feature-specific styles only

Do not duplicate token values in component styles when a token already exists.

If a style is reused across multiple screens or dialogs, move it to `styles/common/*` instead of copy-pasting it into multiple SFCs.

## Token Rules

Use CSS variables from `tokens.scss` as the first choice.

Current token families include:

- surfaces: `--surface-*`
- text: `--text-*`
- borders: `--border-*`
- brand/accent: `--brand-*`, `--accent-*`
- reader: `--reader-*`
- shadows/radius/space/duration/easing
- titlebar, loading, bookmark, scrollbar, cursor variables

When adding a new token:

1. add both light and dark values
2. prefer semantic naming over color naming
3. place it in the nearest existing token family
4. avoid component-specific variable names unless the token is truly local to one feature

Do not hardcode colors in component SCSS if the same semantic meaning already exists in tokens.

## Reader Style Rules

Reader styling is special and must stay split between:

- global CSS variables for app and reader surfaces
- runtime DOM/style injection from `themeService` and `readerStyleService`
- format-specific application in `reader/epub/epubStyleService.ts` and `reader/txt/txtStyleService.ts`

Follow these rules:

- use `themeService` for palette derivation and theme-mode normalization
- use `readerStyleService` to set shared runtime CSS variables
- keep EPUB-specific rendition theme application in `reader/epub`
- keep TXT-specific DOM style assignment in `reader/txt`
- do not reimplement reader palette logic inside Vue components

If a change affects reader color, background, selection, image filter, or theme compatibility, update the palette/runtime service before touching component styles.

## Component Style Placement

Use component-local `<style scoped>` only for feature-local structure and interaction styling.

Move styles out of components when they are:

- shared across multiple components
- part of the app shell or dialog shell
- vendor overrides
- token definitions

Keep these conventions:

- app shell and reader shell colors come from variables
- overlays, shadows, radii, and borders should use system tokens
- reduced motion support must be preserved
- custom cursors should keep using existing cursor variables

## Theme Rules

The app supports light and dark theme via `data-theme`.

When changing theming:

- update `tokens.scss` and `themeService.ts` together when needed
- preserve `getAppThemePalette`, `getReaderRuntimePalette`, and reader background preset compatibility
- keep `syncReaderConfigThemeColors` and related fallback behavior consistent
- do not introduce an alternate theming mechanism outside `data-theme` plus token variables

If a style only works in one theme, fix both themes before finishing.

## Motion And UX Constraints

Keep transitions and animation aligned with existing motion tokens:

- `--duration-fast`
- `--duration-base`
- `--duration-slow`
- `--easing-standard`

Always preserve or add `prefers-reduced-motion` handling for new prominent animations.

Do not add flashy animation that ignores the current restrained desktop-reader feel.

## Change Workflow

Use this workflow for style work:

1. decide whether the change is token-level, common global style, reader runtime style, or component-local style
2. prefer changing tokens first when the issue is semantic color/spacing/shadow consistency
3. update `themeService` and reader style services for runtime reader changes
4. update `styles/common/*` for shared shells and reusable patterns
5. only then patch component-local SCSS
6. verify both light and dark modes

For visual refactors, search for repeated literals before adding new rules:

```powershell
rg -n "#[0-9A-Fa-f]{3,8}|rgba\\(|linear-gradient|box-shadow|border-radius" src
```

## Review Checklist

Before finishing style work, verify:

- no duplicated semantic color values where a token should exist
- no reader palette logic leaked into components
- no vendor override placed in a feature component when it belongs in `styles/vendors`
- no shared dialog or titlebar rule duplicated across SFCs
- both light and dark themes still look coherent
- reduced-motion paths still exist
- reader EPUB and TXT appearances remain reasonably aligned

## Validation

Run:

```powershell
npm run build
```

When the style change affects reader runtime behavior, manually verify:

- main window theme
- reader window theme
- style menu
- dialogs
- titlebar buttons
- EPUB reader and TXT reader presentation

## Common Mistakes

Avoid these mistakes:

- hardcoding one-off colors instead of extending tokens
- styling reader internals only in SCSS when the runtime service owns the value
- patching dark mode only
- scattering dialog shell styles across many component files
- mixing vendor overrides with feature-specific styles
- introducing inconsistent radius, shadow, or spacing values outside the token system
