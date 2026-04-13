---
name: t-reader-rust-backend
description: Develop, refactor, or review the T-Reader Rust backend under `src-tauri/src` using the repository's current layered architecture. Use when changing Tauri commands, backend services, filesystem/WebDAV/AI/updater/window logic, Rust entities, or module layout; especially when work must preserve the existing frontend command contract while following the layered boundary from api to service to repository to entities and utils.
---

# T-Reader Rust Backend

## Overview

Follow this skill when editing the Rust backend for T-Reader.

Treat the backend as a layered desktop Windows Tauri application with this fixed structure:

- `api/`: only `#[tauri::command]` wrappers
- `service/`: business orchestration
- `repository/`: filesystem, WebDAV, system, updater-facing low-level access
- `entities/`: shared DTOs and runtime state structs
- `utils/`: pure helpers
- `command.rs`: unified command registration
- `lib.rs`: minimal startup, plugin wiring, state registration, invoke handler
- `main.rs`: only call `t_reader_lib::run()`

## Start Here

Read these files before making non-trivial backend changes:

1. `src-tauri/src/lib.rs`
2. `src-tauri/src/command.rs`
3. `src-tauri/src/api/mod.rs`
4. `src-tauri/src/entities/mod.rs`
5. `src-tauri/src/repository/mod.rs`
6. `src-tauri/src/service/mod.rs`
7. `src-tauri/Cargo.toml`

When changing one domain, also read its sibling modules first. Example:

- For WebDAV: read `api/webdav.rs`, `service/webdav/*`, `repository/webdav/*`, `utils/webdav.rs`
- For window flow: read `api/window.rs`, `service/window/*`, `entities/reader_window.rs`
- For updater: read `api/updater.rs`, `service/updater/*`, `repository/system/proxy_repository.rs`, `entities/app_update.rs`

## Layer Rules

Enforce these boundaries:

- Let `api` depend on `service`, `entities`, and Tauri types only.
- Let `service` depend on `repository`, `entities`, and `utils`.
- Let `repository` depend on `entities` and `utils`, not on `api` or `service`.
- Keep `entities` free of I/O and orchestration.
- Keep `utils` free of business decisions and Tauri command attributes.

Do not place `#[tauri::command]` outside `api/`.

Do not put `std::fs`, `reqwest`, registry access, or raw Tauri window builder logic inside `api/`.

Do not make `lib.rs` a dumping ground for command imports or business logic.

## Module Placement

Use these placement rules when adding or moving code:

### `entities/`

Put here:

- persisted DTOs such as `Book`, `Settings`, `StoredBook`
- frontend-facing response payloads
- runtime state such as `ReaderWindowState`, `AppUpdateState`

Split by concept, not by old file history. Prefer one concept per file.

### `repository/local_fs/`

Put here:

- local directory names and local path resolution
- local file read/write/delete/list helpers
- settings file persistence
- book progress JSON enumeration

Keep this layer low-level. Return plain Rust data, not Tauri command wrappers.

### `repository/webdav/`

Put here:

- WebDAV client creation
- file upload/download/delete/exists/list primitives
- directory creation primitives

Keep sync policy out of this layer.

### `repository/system/`

Put here:

- system font enumeration
- Windows proxy detection

Keep platform checks localized here when possible.

### `service/filesystem/`

Put here:

- orchestration around local dirs, local file commands, settings loading, book progress loading

### `service/webdav/`

Put here:

- cloud dir preparation
- file transfer orchestration
- sync policy and conflict resolution

### `service/ai/`

Put here:

- stream request construction
- model request/response orchestration
- event streaming to the reader window

### `service/updater/`

Put here:

- update source selection
- proxy application
- update checking, token management, install progress emission

### `service/window/`

Put here:

- reader window creation
- message ACK flow
- event dispatching
- reader runtime state transitions

### `service/font/`

Put here:

- font repository orchestration and output shaping if needed

## Command Contract Rules

Preserve existing frontend command names unless the task explicitly asks for a command rename.

Current command exposure is centralized in `src-tauri/src/command.rs`. When adding a new command:

1. Implement it in the correct `api/*.rs` file.
2. Keep the command name aligned with existing naming conventions.
3. Register it in `command.rs`.
4. Update any managed state in `lib.rs` only if the command needs new shared runtime state.

When refactoring internals, prefer keeping:

- command names unchanged
- argument shapes unchanged
- serialized JSON field names unchanged

## Windows Desktop Rules

Target desktop Windows only.

Follow these constraints:

- Do not introduce mobile entry points or mobile-only code paths.
- Prefer Windows behavior when dealing with proxy, filesystem, or updater handoff.
- Keep non-Windows code only as minimal compile-time fallback when required by dependencies.
- Do not design new behavior around Android or iOS support.

If you notice old mobile-oriented conditions or dead compatibility branches, remove them when safe.

## Change Workflow

Use this workflow for backend work:

1. Identify the domain:
   `filesystem`, `webdav`, `ai`, `updater`, `window`, or `font`
2. Decide the layer for each change before editing.
3. Add or update `entities` first if the data shape changes.
4. Update `repository` next if low-level access changes.
5. Update `service` orchestration next.
6. Update `api` wrappers last.
7. Register commands in `command.rs` only after the implementation compiles.
8. Keep `lib.rs` focused on startup wiring.

When a file starts mixing multiple layers, split it instead of adding comments to justify the coupling.

## Review Checklist

Before finishing backend work, verify:

- No `#[tauri::command]` leaked outside `api/`
- No business logic leaked into `lib.rs`
- No `service -> api` or `repository -> service` reverse dependency
- No command contract breakage unless explicitly requested
- No mobile-specific behavior added
- New modules have `mod.rs` wired correctly
- New state types live in `entities/`, not `api/`

## Validation

Run these checks after backend changes:

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
npm run build
```

For structure-heavy refactors, also search for stale imports:

```powershell
rg -n "crate::command::|crate::model::|crate::logging::" src-tauri/src
```

If the task touched command exposure, inspect:

```powershell
Get-Content src-tauri/src/command.rs
Get-Content src-tauri/src/lib.rs
```

## Common Mistakes

Avoid these common mistakes:

- Reintroducing a large `command/*.rs` style module that mixes command, state, and business logic
- Putting sync policy in `repository/webdav`
- Putting path policy in `api/file.rs`
- Putting `reqwest` calls directly in `api`
- Adding new root modules instead of fitting code into the layered structure
- Forgetting that runtime state structs belong in `entities`
- Changing field names in serialized structs without checking frontend compatibility
