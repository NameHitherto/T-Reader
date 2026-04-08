---
name: t-reader-frontend-architecture
description: Develop, refactor, or review the T-Reader frontend under `src/` using the repository's current Vue 3 layered architecture. Use when changing components, composables, stores, services, routes, cross-window events, book or reader flows, or frontend module layout; especially when work must preserve the current layered boundary from components through composables, store, and services to types, utils, and constants, plus the dual-entry main-window and reader-window structure.
---

# T-Reader Frontend Architecture

## Overview

Follow this skill when editing frontend business code in T-Reader.

Treat the frontend as a dual-entry desktop Vue application with:

- main window: `index.html` + `src/main.ts`
- reader window: `reader.html` + `src/readerMain.ts`

The frontend is layered around `components`, `composables`, `store`, `services`, `types`, `utils`, and `constants`.

## Start Here

Read these files first before making non-trivial frontend changes:

1. `src/main.ts`
2. `src/readerMain.ts`
3. `src/App.vue`
4. `src/ReaderApp.vue`
5. `src/router/index.ts`
6. `docs/module-architecture-spec.md`

Then read the nearest domain files involved in the change:

- bookshelf/import/library work:
  `src/components/MainContent.vue`
  `src/services/book/*`
- reader/runtime work:
  `src/ReaderApp.vue`
  `src/services/reader/*`
- app settings/theme work:
  `src/services/settings/*`
  `src/services/theme/*`
- window/titlebar/event bridge work:
  `src/services/window/*`
  `src/services/reader/readerWindow*.ts`

## Layer Rules

Keep these boundaries intact:

- `components/`: presentation, view state wiring, lifecycle hookup
- `composables/`: reusable interaction logic shared by components
- `store/`: reactive state and explicit mutation API only
- `services/`: business logic, orchestration, persistence, adapters, bridges
- `types/`: shared domain types
- `utils/`: side-effect-light utilities
- `constants/`: event names and shared constants

Do not let components directly implement:

- file persistence
- WebDAV or sync policy
- book parsing or cache rebuild policy
- large cross-window event choreography
- low-level DOM/global listener binding without cleanup

If component code starts growing orchestration branches, move the logic into `services/` first and then add a composable only if the UI needs a reusable interaction shell.

## Current Domain Shape

### `src/services/book`

Use this domain for:

- import metadata parsing
- `bookKey` generation and identity helpers
- local/cloud config loading
- cache priming and cache reads
- bookshelf-facing presentation helpers
- AI-readable book content extraction

Respect the current subdomains:

- `book/epub/*`: EPUB-specific parsing/cache/content logic
- `book/txt/*`: TXT-specific parsing/cache/import logic
- root `book/*.ts`: façade, shared config, repository, presentation

Keep format-specific logic out of root façade files unless it is only dispatch.

### `src/services/reader`

Use this domain for:

- reader loading and save flows
- window bridge and event orchestration
- interaction policy
- style application
- format dispatch

Respect the current subdomains:

- `reader/epub/*`: EPUB rendition, TOC, bookmarks, CFI/progress, EPUB style application
- `reader/txt/*`: TXT paragraph parsing, navigation, progress, TXT style application
- root `reader/*.ts`: façade, shared style/config/loading/window orchestration

If logic depends on `epub.js`, `Rendition`, CFI, TOC, or annotations, it belongs in `reader/epub`.

If logic depends on text paragraphs, scroll position, paragraph index, or `txt-reader`, it belongs in `reader/txt`.

## Component Placement Rules

Use these placement rules when adding frontend code:

- put reusable modal/view widgets in `src/components`
- keep route-level page assembly in route-facing components such as `MainContent.vue`, `BookMark.vue`, `AboutView.vue`
- keep root reader orchestration in `ReaderApp.vue`, but do not add new low-level business algorithms there
- put cross-component helper state in `composables`
- put persistent or domain-owned state in `store`

Do not create a new top-level domain folder when one of these already exists:

- `services/book`
- `services/reader`
- `services/settings`
- `services/theme`
- `services/window`
- `services/sync`
- `services/update`
- `services/fileSystem`
- `services/notification`

## Events And Contracts

Use `src/constants/events.ts` as the only source of truth for cross-window event names.

Keep these conventions:

- main window and reader communicate with `bookKey`
- reader titlebar actions flow through window events
- style/theme updates go through explicit bridge services
- direct string event names in components are not acceptable

When adding new cross-window behavior:

1. define the event constant
2. expose or reuse a bridge service
3. register/unregister listeners with cleanup
4. keep the component side thin

## Types And Imports

Use:

- `src/types/book.ts` for shared book and progress types
- `src/types/contextMenu.ts` for context menu data contracts
- alias imports via `@/`

Do not reintroduce cross-layer relative path tunneling when `@/` is available.

When a new type is shared by multiple domains, put it in `types/`. If it is only internal to one service file or one component, keep it local.

## Change Workflow

Use this workflow for frontend changes:

1. identify the user-facing flow: bookshelf, reader, settings, theme, sync, update, or window
2. identify whether the change is view-only, interaction-only, or business logic
3. place business logic in `services` first
4. place reusable UI interaction glue in `composables` if needed
5. keep component edits focused on props, refs, rendering, and lifecycle hookup
6. keep store edits focused on state shape and explicit actions
7. update types/constants before wide refactors

If the change touches both main window and reader window, verify both entrypoints and bridge services, not just one component.

## Review Checklist

Before finishing frontend work, verify:

- no component directly writes filesystem or sync logic
- no new event strings bypass `constants/events.ts`
- no format-specific EPUB/TXT algorithm leaked into root façade files
- no `components` file became a repository or service in disguise
- every global listener has cleanup
- new imports use `@/`
- shared types live in `types/`

## Validation

Run after frontend changes:

```powershell
npm run build
```

For changes touching backend bridges or Tauri commands, also run:

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
```

Useful search checks:

```powershell
rg -n "addEventListener|listen\\(" src
rg -n "format === 'epub'|format === 'txt'" src/services
rg -n "emit\\(|dispatch" src/services src/components
```

## Common Mistakes

Avoid these mistakes:

- adding persistence logic directly to `MainContent.vue` or `ReaderApp.vue`
- putting TXT and EPUB algorithms back into one mixed service file
- bypassing façade services and importing deep internals without reason
- creating new global events without constants
- expanding store responsibility into I/O orchestration
- coupling UI state, domain state, and persistence in one component method
