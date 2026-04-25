# Profiles

Profile manifests in this directory assemble reusable global assets plus profile-owned local assets.

## Commands
- Rebuild generated outputs after profile changes: `bun run build`
- Recheck the OpenCode skill isolation rule tests when changing profile-local skill behavior: `bun test harnesses/opencode/scripts/lib/__tests__/profileLocalAssetRules.test.ts`

## Local conventions
- Keep reusable skills in `skills/` and reusable commands in `commands/`. Put assets under `profiles/<name>/skills/` or `profiles/<name>/commands/` only when they are intentionally owned by a single profile.
- In profile manifests, `skills: ['*']` means all global skills only. A profile also gets its own `profiles/<name>/skills/*` skills, but it must not gain access to another profile's local skills.
- Treat `profiles/<name>/skills/*` as isolated to that profile. If another profile should use the same skill, promote it to `skills/<skill-name>/` instead of duplicating or relying on wildcard access.
- Profile-local commands are namespaced automatically as `--<profile>-<filename>.md`. Do not pre-prefix filenames with `--`.

## Boundaries
- Always: run `bun run build` after editing any profile manifest or profile-local asset in this directory.
- Ask first: changing profile manifest semantics, moving a local skill into `skills/`, or altering OpenCode permission generation.
- Never: assume a wildcard skill entry exposes one profile's local skills to another profile, or add profile-specific content to global `skills/` just to bypass isolation.

## References
- `README.md`
- `AGENTS.md`
- `harnesses/opencode/scripts/lib/profileLocalAssetRules.ts`
