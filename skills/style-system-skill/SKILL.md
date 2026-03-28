---
name: t-reader-style-system
description: Use when designing, refactoring, or reviewing any T-Reader UI style, theme behavior, dialog, reader chrome/content, titlebar, Element Plus visual override, or component appearance. Covers the project's light/dark dual-theme system, style layer boundaries, theme persistence, window sync, reader-body sync, and rules for where style changes must live.
---

# T-Reader Style System

## Follow This Contract

- Treat `light | dark` as the only global theme modes.
- Treat the global theme as the only source of truth for UI and reader body colors.
- Keep the theme entry only in the settings center.
- Persist theme mode in `setting.json` through `Settings.themeMode`.
- Apply theme by setting `data-theme` on `document.documentElement`.
- Broadcast theme changes with `WINDOW_EVENTS.UPDATE_APP_THEME`.
- Keep `ReaderConfig.color` and `ReaderConfig.fontColor` only as compatibility fields. Do not use them as the primary theme control.

## Read These Files First

- Theme tokens: `src/styles/theme/tokens.scss`
- Style entry: `src/styles/index.scss`
- Global styles: `src/styles/global/reset.scss`, `src/styles/global/base.scss`
- Common styles: `src/styles/common/components.scss`, `src/styles/common/dialogs.scss`, `src/styles/common/titlebar.scss`
- Vendor styles: `src/styles/vendors/element-plus.scss`, `src/styles/vendors/highlight.scss`
- Settings persistence: `src/services/settings/appSettingsService.ts`
- Theme application and broadcast: `src/services/theme/themeService.ts`
- Window events: `src/constants/events.ts`
- Main bootstraps: `src/main.ts`, `src/readerMain.ts`
- Theme entry UI: `src/components/SettingDialog/index.vue`
- Reader theme consumption: `src/ReaderApp.vue`, `src/services/reader/readerStyleService.ts`

## Use The Five-Layer Style Model

### 1. Theme Layer

- Put all semantic tokens in `src/styles/theme/tokens.scss`.
- Define colors, surfaces, text, borders, shadows, radii, spacing, motion, scrollbar, and reader tokens here.
- Keep raw visual values here, not in business components.
- Add both light and dark mappings together.

### 2. Global Layer

- Put reset, root sizing, page base containers, shared background behavior, and motion baseline in `src/styles/global/`.
- Do not place component-specific business styling here.

### 3. Vendor Layer

- Put third-party visual overrides only in `src/styles/vendors/`.
- Map Element Plus through `--el-*` variables in `src/styles/vendors/element-plus.scss`.
- Keep code highlighting theme-aware in `src/styles/vendors/highlight.scss`.
- If a new dependency needs styling, create a dedicated vendor file and import it from `src/styles/index.scss`.

### 4. Common Layer

- Put reusable project UI patterns in `src/styles/common/`.
- Centralize buttons, dialog shells, message feedback, titlebar behavior, cards, empty states, and shared utility surfaces here.
- Reuse common classes before adding component-local visual rules.

### 5. Local Component Layer

- Keep component-local styles only for structure, layout, and rare special interaction.
- Do not define theme colors, border systems, shadow systems, or brand accents here unless the value comes from a token.
- If a local rule starts being reused, promote it to the common layer.

## Obey These Non-Negotiable Rules

- Do not add hard-coded theme colors inside components.
- Do not add duplicate shadow, radius, or border systems inside components.
- Do not introduce `.dark` or manual theme class switching.
- Do not build a Pinia theme store.
- Do not add another global theme entry outside settings.
- Do not let `StyleMenu` control app-wide light/dark mode.
- Do not directly style third-party components inside feature components when the rule belongs in the vendor layer.

## Handle Icons And SVGs This Way

- Prefer `currentColor` for inline SVG.
- Prefer mask-based icons for monochrome app icons.
- For shared app icons, register them in `src/icons/registry.ts` and render through `src/components/common/AppIcon/index.vue`.
- For titlebar icons in `index.html` and `reader.html`, use the `titlebar-icon` mask pattern instead of fixed black/white image rendering.
- Allow fixed colors only for true multicolor assets or curated palette data such as bookmark color choices.

## Handle Theme State This Way

### Persistence

- Read and write theme mode through `loadAppSettings()` and `saveAppSettings()`.
- Normalize unknown values to `light`.
- Keep the Rust model backward compatible when old `setting.json` files miss `themeMode`.

### Runtime Application

- Initialize theme in both `src/main.ts` and `src/readerMain.ts` before mount.
- Apply theme with `applyAppThemeMode()`.
- Emit cross-window updates with `emitAppThemeUpdate()`.

### Reader Sync

- Use `getAppThemePalette()` and `syncReaderConfigThemeColors()` when reader UI or reader config needs theme-derived colors.
- Keep actual reader body colors driven by the global theme palette.
- If reader body styling changes, update `src/ReaderApp.vue` and `src/services/reader/readerStyleService.ts` together.

## Handle Settings And Reader Responsibilities This Way

### SettingDialog

- Keep theme mode selection at the top of the settings center.
- Allow temporary selection while the dialog is open.
- Persist and broadcast only after clicking save.
- Cancel must not change the saved theme.

### StyleMenu

- Keep only typography, spacing, pagination, and font controls.
- Show the current global theme as status only.
- Do not add theme switching controls back here.

## Use These Exceptions Carefully

- Theme palette constants in `src/services/theme/themeService.ts` are allowed because runtime services need direct color values.
- Bookmark highlight palette constants in `src/constants/bookmark.ts` are allowed because they are user-selectable content colors, not app theme tokens.
- Reader compatibility fields `color` and `fontColor` may be written during save/load sync, but must stay derived from the current app theme.

## Choose The Right File For Each Change

- Add or change semantic color, shadow, radius, spacing, reader tone:
  `src/styles/theme/tokens.scss`
- Change reset, body, root container, global scrollbar, baseline shell:
  `src/styles/global/*`
- Change Element Plus, MessageBox, Loading, Select, Dialog, Highlight.js visuals:
  `src/styles/vendors/*`
- Change shared button, dialog shell, common card, titlebar, feedback:
  `src/styles/common/*`
- Change only one component's structure or unique layout:
  that component's local `<style>` block
- Change theme persistence or broadcast:
  `src/services/settings/appSettingsService.ts`, `src/services/theme/themeService.ts`, `src/constants/events.ts`
- Change reader content theme behavior:
  `src/ReaderApp.vue`, `src/services/reader/readerStyleService.ts`, related reader services

## Follow This Implementation Workflow

1. Find whether the requested style change is theme, global, vendor, common, or local.
2. Add or reuse semantic tokens before touching component styles.
3. Update shared/common or vendor layers if the rule is reusable.
4. Keep component-local changes minimal and token-driven.
5. If the change affects both windows, verify `main` and `reader` consumption paths.
6. If the change affects reader body colors, verify both EPUB and TXT paths.
7. If the change affects settings, preserve save/cancel semantics.

## Use This Review Checklist

- Is every new visual value token-driven unless it is an approved exception?
- Is the change placed in the correct style layer?
- Does light mode and dark mode both render correctly?
- Does the main window update immediately after saving theme?
- Does an already-open reader window update immediately?
- Do dialogs, menus, messages, loading masks, and titlebars follow the same theme?
- Does reader正文 remain readable in both EPUB and TXT?
- Did the change avoid reintroducing local hard-coded colors or manual dark classes?

## Validate Before Finishing

- Run `npm run build`.
- Check theme save, cancel, reopen persistence, and window sync behavior when the change touches theme flow.
- Check Element Plus dialogs, inputs, selects, switches, messages, loading, and MessageBox when the change touches shared UI.
- Check shelf, settings, StyleMenu, system font dialog, help/about/assistant/bookmark panels when the change affects broad visual language.
