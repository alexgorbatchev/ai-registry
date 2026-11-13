---
name: penpot
description: Use when reading, creating, organizing, or reviewing Penpot designs through the Penpot MCP plugin, including library colors, typographies, components, variants, design tokens, pages, boards, exporting shapes, and mirroring another Penpot file's asset organization.
author: alexgorbatchev
metadata:
  created_on: 2026-11-12 16:45
  last_modified: 2026-11-12 16:45
  status: current
---

## Connect and orient

1. Read the server's high-level overview tool once per session before writing plugin code. Look up unfamiliar types and members with `penpot_api_info` instead of guessing property names or value types.
2. Before any write, run a read-only probe that returns `penpot.currentFile` (id, name), the current page, `penpotUtils.getPages()`, local library counts (colors, typographies, components, token sets), and `penpot.library.connected` names and IDs. Compare the file ID with the `file-id=` parameter of any workspace URL the user gave.
3. The plugin acts only on the file open in the browser tab where the user connected it; tools cannot open workspace URLs. When the connected file is not the one the task needs, ask the user to open that file and connect the plugin there, then probe again.
4. A linked library in `penpot.library.connected` can return empty colors, components, and tokens when it is unpublished or not loaded, and `availableLibraries()` can be empty. Treat empty linked-library contents as unknown. Read such a library by having the user connect the plugin to the library's own file.

## Work across files

- Work on one connected file at a time. To use one file as a reference for another, connect to the reference, extract what the task needs, and write the extraction to a local file before asking the user to switch. Conversation context can be compacted and plugin `storage` does not carry data between files.
- Do not modify a reference or library file unless the user asked for changes there.

## Run plugin code

- Batch related reads or writes into one `execute_code` call and return only the data needed. Do not also log returned data.
- Some MCP gateways pause each call for approval. Show the pending request to the user, and resume it only when the user has authorized that Penpot work in the current task. Resume the paused request rather than running the code again, because a partially applied write is not rolled back.
- Keep helper functions and intermediate results in `storage` for the current connected session; re-derive them after the user switches or reconnects.
- Make write scripts idempotent: read existing assets first, then update matches by group path and name instead of creating duplicates. After an interrupted or failed write, re-read the file state before retrying.

## Build library assets

- Take values from the authoritative source, such as theme CSS, token files, or component code. Do not sample colors from screenshots or invent missing values.
- Convert CSS colors with [the color conversion script](scripts/css-color-to-penpot.ts): `bun scripts/css-color-to-penpot.ts '<css color>' [...]`, run from this skill's directory. Penpot library colors take an uppercase `#RRGGBB` value plus a separate opacity. It accepts hex, `rgb()`/`rgba()`, and `oklch()`; it rejects `var()`, `calc()`, and `color-mix()`. Resolve references from the source's own rules first. When a value depends on runtime context, such as `color-mix()` against `transparent`, compute it only when the result is exact (for example a percentage of one color mixed with `transparent` is that color at that opacity); otherwise list it as skipped with the reason.
- Check font availability with `penpot.fonts.findByName()` before creating typographies. When the source font stack resolves only to system fonts that Penpot cannot store, ask which stand-in to use, or skip those typographies and report them.
- Follow the organization the user names. When it is Penpot's Pencil design system, read [the Pencil library organization](references/pencil-library.md) before naming groups, assets, pages, or boards. Copy the structure, not its defects, such as duplicated or malformed names.
- Encode variant axes that the source switches at runtime, such as light and dark mode, presets, or density, in group paths or token themes consistently across every asset type. Propose design tokens when the source defines one value per theme context and tokens would replace duplicated flat assets; create them only when the user agrees, since they change how designers consume the library.
- For components, build boards with flex or grid layouts and semantic layer names, then create the component; create variant groups with `penpotUtils.createVariantContainer()`.

## Verify and report

1. Re-read the library after writing and compare it with the source inventory: every intended value present exactly once, correct group path, hex, and opacity, and no leftover duplicates.
2. Export changed boards or component main instances with `export_shape` as PNG and inspect the images before reporting visual work as complete.
3. Report what was created or updated, what was skipped and why, and any decision still needed from the user.
