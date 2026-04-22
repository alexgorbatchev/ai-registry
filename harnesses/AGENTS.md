# Harnesses

This directory contains source-of-truth harness overrides and maintenance notes for generated configs.

## General Rules

- Keep harness-specific behavior inside `harnesses/<name>/`.
- Only files under `harnesses/<name>/` are copied into that harness output during `bun run build`.
- Shared repo-level system instruction fragments live under `system/`; they are referenced from harness configs and profile includes, not copied verbatim into `.output/` unless a harness explicitly ships them.
- Do not place repo-only maintenance notes inside a harness subdirectory unless they are intentionally meant to ship into generated output.
- If a unified harness needs custom output shaping beyond raw file copying, put the repo-local build plugin at `harnesses/<name>/scripts/build.ts` and keep that path ignored via `.registry-ignore`.
- Prefer the harness's native configuration surface over local wrapper files when the harness already supports the feature directly.
- Pin external plugin versions and commit SHAs so generated outputs stay reproducible.

## OpenCode

- Register external OpenCode plugins in `harnesses/opencode/opencode.jsonc` under the `plugin` array.
- Keep the OpenCode unified-output plugin in `harnesses/opencode/scripts/build.ts`.
- Prefer direct package specs such as `name@version`.
- For unpublished plugins, use a pinned Git spec or a direct `file://...` spec.
- If a local file plugin needs runtime dependencies from the repo install, vendor the package under `vendor/<name>/` as a Bun workspace and point `opencode.jsonc` at `file://{{repo_root}}/vendor/<name>/...`.
- Keep shipped OpenCode config in `harnesses/opencode/`, but keep installable third-party plugin source out of that directory unless it truly needs to be copied into generated output.
- Do not add proxy wrapper plugins under `harnesses/opencode/plugins/` unless a plugin truly must be loaded from a local file entrypoint.
- Use tuple form `[spec, { ... }]` only when a plugin needs inline startup options.

## Maintenance

- After editing anything in `harnesses/`, run `bun run build`.
- Verify the generated copies in `.output/`.
