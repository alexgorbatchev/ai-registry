---
created_on: 2026-11-10 11:33
last_modified: 2026-11-10 11:33
status: current
---

# Registry generation contracts

For agents modifying or diagnosing these contracts. Paths are relative to the repository root.

## Unified Outputs

The script generates final harness outputs in `.output/`. It writes one root per harness: `.output/opencode`, `.output/codex`, `.output/pi`, and `.output/claude-code`. Every harness ships every registry skill and command. Generated harness skills are merged flat from `skills/agent/`, `skills/user/`, overlay `skills/`, or `harnesses/<target>/skills/`, with build-time template tags resolved and `disable-model-invocation: true` automatically injected for user skills. Skills that are not authored by `alexgorbatchev` are emitted with their author prefix as `<author>-<skill>` in both directory name and frontmatter `name` across all harness outputs. They are copies rather than symbolic links so that EJS tags inside `SKILL.md` and bundled skill files reach the agent resolved; edits made to a generated skill are recovered through the generated-output drift and sync-back flow instead of writing straight through a link.

## Harness Skill Override Precedence

Harness-specific skills under `harnesses/<target>/skills/` (grouped into `agent/` and `user/`) take precedence over global skills (`skills/` and overlay `skills/`) on name collision across all four harnesses (OpenCode, Codex, Pi, and Claude Code). When a collision occurs, the harness-specific skill cleanly overrides the global skill in the generated output for that harness target.

## Hostname Skill Variants

Keep a default `SKILL.md` in each skill bundle. The build selects `variants/<hostname>/SKILL.md` within the resolved bundle using the OS hostname or `AI_REGISTRY_HOSTNAME`, with exact case-sensitive matching and default fallback when no matching directory exists. Hostnames start with a letter or digit and contain only letters, digits, dots, underscores, or hyphens; empty or invalid overrides fail. Matching variants must contain a regular `SKILL.md`, valid YAML frontmatter, a non-empty description and body, and the same name and author as the default. Selection follows existing overlay and harness precedence, applies to reusable and harness-local skills, and changes only the emitted root `SKILL.md`. Shared resources come from the bundle root; exclude its entire `variants/` directory from generated output. Keep actual private hostnames and environment instructions in the private overlay, which replaces whole bundles. Preserve the selected source mapping through template rendering and output assembly; `file_path` and `file_dir` refer to the selected variant's original path. The manifest records skill source paths, and sync-back rejects recovery when the recorded source differs from the current selection. Edit include-based skills at their source because sync-back does not reconstruct include directives.

## Harness Plugins

A harness can keep target-specific output shaping in `packages/registry-cli/src/harnesses/<target>/build.ts`. The root build resolves every registry skill and command once, then calls each plugin's `buildOutput` hook to write that harness's root under the staging directory.

## No Top-Level Harness Code

The top-level scripts (`packages/registry-cli/src/commands/buildCommand.ts` and `packages/registry-cli/src/commands/bootstrapCommand.ts`) MUST NOT contain any harness-specific generation logic, hardcoded template paths, or target-specific helper script generation. All such logic must live exclusively within the respective harness plugin (`packages/registry-cli/src/harnesses/<target>/build.ts`).

## Source Tree Ignores

When the build stages files from `skills/`, `commands/`, and `harnesses/<target>/`, it honors nested `.registry-ignore` files with `.gitignore`-style matching so repo-local scratch files can stay out of generated outputs.

## Script Layout

Executable repo entrypoints stay directly under `packages/registry-cli/src/bin/` and use dash-based filenames. TypeScript helpers that are imported by other scripts and are not meant to be run directly belong under `packages/registry-cli/src/lib/`.

## Public CLI Helpers

Any wrapper script intended for `~/.local/bin/` symlinking (for example `air-*`, `claude-*`, `codex-*`, or `pi-*`) MUST NOT be checked into `packages/registry-cli/src/bin/`. Instead, `packages/registry-cli/src/commands/buildCommand.ts` must generate them into `.output/bin/` during the build process, and `packages/registry-cli/src/commands/bootstrapCommand.ts` will symlink them from there.

## Generated Output Templates

Keep source filenames and use native EJS syntax in text files. Use raw output tags such as `<%- repo_root %>`, `<%- file_path %>`, and `<%- file_dir %>`; the latter two identify the original source across nested includes. Use `<%- include("/system/system.md") %>` for repository-root-relative includes and `<%- env("VAR_NAME", "fallback") %>` for environment values with an optional fallback. EJS expressions and control flow are supported. Render each file exactly once; `<%%` emits a literal opening delimiter. Foreign `{{...}}` syntax passes through unchanged. `env()` reads the build's own environment first; a variable it lacks comes from the user's login shell (`shell-env`, `$SHELL -ilc`), started at most once per build and only when a template needs it, so scheduled builds see values that only interactive shell startup files export. Do not render secrets with empty fallbacks: a missing value must fail the build so a scheduled run keeps the last good output instead of writing blanks. Unknown variables, invalid JavaScript, missing includes, and environment values missing from both the build and the login shell without fallbacks fail the build. Resolved includes cannot escape the repository root. Templates execute trusted JavaScript. Generated-edit recovery supports canonical raw path-variable tags; edit other EJS templates at their source.

## Canonical Path References

When checked-in guidance or generated text needs a canonical path inside this repository that would otherwise be machine-specific and absolute, use template variables instead of hardcoded absolute paths. Prefer the most specific token available for canonical folders: `<%- skills_dir %>/...`, `<%- commands_dir %>/...`, and `<%- output_dir %>/...`. For canonical folders without a dedicated token, anchor the path from `<%- repo_root %>`, such as `<%- repo_root %>/harnesses/...`, `<%- repo_root %>/system/...`, `<%- repo_root %>/vendor/...`, `<%- repo_root %>/packages/registry-cli/...`, `<%- repo_root %>/README.md`, and `<%- repo_root %>/AGENTS.md`. Use normal repo-relative paths elsewhere in checked-in docs.

## Private Overlay Registries (`AI_REGISTRY_OVERLAY`)

Read a PATH-style list of external registry directories using the platform path delimiter. Expand home and relative paths, ignore empty entries, warn and skip missing paths, and deduplicate normalized paths by keeping their last occurrence. Merge `skills/` and `commands/` from left to right; the last matching name replaces the whole skill bundle or command. Overlay `harnesses/<path>` files layer the public synced settings file at the same `harnesses/<path>`: the build renders them as templates, deep-merges them over the public source in overlay order (objects merge per key; other values, lists included, replace), and fails on any overlay harness file that matches no synced settings file. Settings sync writes each harness edit to the layer defining the longest part of its key path, with later overlays winning ties, and removes a deleted key from every layer that defines it. Build and bootstrap print skill conflict notes identifying selected and replaced sources. Preserve harness-specific skill override precedence. The `overlay_dir` template variable identifies the last active overlay; use `file_dir` for resources relative to assets in other overlays.
