---
name: penpot
description: Use when reading, creating, organizing, or reviewing Penpot designs through the Penpot MCP plugin, including design-system libraries, design tokens, library colors, typographies, components, variants, pages, boards, image or Storybook screenshot import, exporting shapes, and mirroring another Penpot file's asset organization.
author: alexgorbatchev
metadata:
  created_on: 2026-11-12 16:45
  last_modified: 2026-11-12 17:51
  status: current
---

## Connect and orient

1. Read the server's high-level overview tool once per session before writing plugin code. Look up unfamiliar types and members with `penpot_api_info` instead of guessing property names or value types.
2. Before any write, run a read-only probe that returns `penpot.currentFile` (id, name), the current page, `penpotUtils.getPages()`, local library counts (colors, typographies, components, token sets), and `penpot.library.connected` names and IDs. Compare the file ID with the `file-id=` parameter of any workspace URL the user gave.
3. The plugin acts only on the file open in the browser tab where the user connected it; tools cannot open workspace URLs. When the connected file is not the one the task needs, ask the user to open that file and connect the plugin there, then probe again.
4. A linked library in `penpot.library.connected` can return empty colors, components, and tokens when it is unpublished or not loaded, and `availableLibraries()` can be empty. Treat empty linked-library contents as unknown. Read such a library by having the user connect the plugin to the library's own file.
5. When a call reports that the plugin tab is suspended (no heartbeat) or that no Penpot instance is connected, ask the user to focus the tab or reconnect the plugin; background tabs are throttled by the browser. Retry only after they confirm.

## Work across files

- Work on one connected file at a time. To use one file as a reference for another, connect to the reference, extract what the task needs, and write the extraction to a local file before asking the user to switch. Conversation context can be compacted and plugin `storage` does not carry data between files.
- Do not modify a reference or library file unless the user asked for changes there.

## Run plugin code

- Batch related reads or writes into one `execute_code` call and return only the data needed. Do not also log returned data. Gateways can stop waiting after about 30 seconds, so split long work into calls that each finish well within that, and keep large inputs in files fetched by plugin code (see [image import](references/image-import.md)) instead of pasting them into calls.
- Some MCP gateways pause each call for approval. Show the pending request to the user, and resume it only when the user has authorized that Penpot work in the current task. Resume the paused request rather than running the code again, because a partially applied write is not rolled back.
- Keep helper functions and intermediate results in `storage` for the current connected session; reinstall them after the user switches files or the plugin reconnects.
- Make write scripts idempotent: read existing assets first, then update matches by group path and name instead of creating duplicates. After an interrupted, failed, or timed-out write, re-read the file state before retrying.

## Plan the library

Before creating or reorganizing assets meant for reuse by other files, read [reusable library structure](references/reusable-library.md) and propose the file split, source of truth, and naming to the user when the file does not already follow it. In particular:

- When the system has design tokens, make tokens the single source of truth. Do not duplicate token values as library colors or typographies; mode-specific copies contradict themes. Removing existing duplicates deletes user-visible assets, so confirm before deleting them.
- Keep screenshots and other reference material out of the published library, in a separate file connected to it.
- Consumers receive tokens only after choosing the library with "Set as tokens source", and token import is unavailable in such consumer files; tell the user when either affects their setup.

## Build library assets

- Take values from the authoritative source, such as theme CSS, token files, or component code. Do not sample colors from screenshots or invent missing values.
- Convert CSS colors with [the color conversion script](scripts/css-color-to-penpot.ts): `bun scripts/css-color-to-penpot.ts '<css color>' [...]`, run from this skill's directory. It returns uppercase `#RRGGBB` plus a separate opacity for library colors; for color tokens, write `#RRGGBB` or `rgba(r, g, b, a)`. It accepts hex, `rgb()`/`rgba()`, and `oklch()`; it rejects `var()`, `calc()`, and `color-mix()`. Resolve references from the source's own rules first: a source alias becomes a token reference such as `{color.border}`. When a value depends on runtime context, such as `color-mix()` against `transparent`, compute it only when the result is exact (a percentage of one color mixed with `transparent` is that color at that opacity); otherwise list it as skipped with the reason.
- Create token sets in precedence order, and create the sets and tokens a reference points to before the referencing token; `addToken` rejects references it cannot resolve yet with `invalid-token-value`. Activate a theme after creating its sets so references resolve.
- Penpot shadow tokens reject negative spread. When the source uses a negative spread, report the value and ask whether to omit the token or approximate it; do not silently clamp it.
- Use only fonts the source names. Check each with `penpot.fonts.findByName()` before creating typographies or font tokens, and confirm the returned name and `fontId` match, because lookup can return a near match (for example a Tight or Condensed family). When the source names only system font stacks, such as `system-ui`, skip those typographies and report the gap; do not suggest stand-in fonts from other projects or upstream defaults.
- Follow the organization the user names. When it is Penpot's Pencil design system, read [the Pencil library organization](references/pencil-library.md) before naming groups, assets, pages, or boards. Copy the structure, not its defects, such as duplicated or malformed names.
- Encode variant axes that the source switches at runtime, such as light and dark mode, presets, or density, as token sets and theme groups; without tokens, use the same group-path scheme across every asset type.
- For components, build boards with flex or grid layouts and semantic layer names, then create the component; create variant groups with `penpotUtils.createVariantContainer()`.
- To place local images or screenshots of an implementation, such as one board per Storybook story, follow [image import](references/image-import.md). It covers the loopback asset server, browser permission prompt, plugin decoding helpers, and the Storybook capture script.

## Verify and report

1. Re-read the library after writing and compare it with the source inventory: every intended value present exactly once, correct group path, hex, opacity, and references, and no leftover duplicates. For large inventories, compare a fingerprint (sorted, joined values hashed in plugin code and locally) instead of returning every value.
2. Export changed boards or component main instances with `export_shape` as PNG and inspect the images before reporting visual work as complete. Check image rectangles for `fillImage` when exports are too small to judge.
3. Report what was created or updated, what was skipped and why, and any decision still needed from the user.
