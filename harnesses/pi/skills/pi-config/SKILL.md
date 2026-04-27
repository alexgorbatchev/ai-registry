---
name: pi-config
description: Configure Pi Coding Agent (`pi`) settings, prompts, skills, models, and repo-local `.pi` directories. Use when working with Pi config files such as `settings.json`, `models.json`, `SYSTEM.md`, `APPEND_SYSTEM.md`, `prompts/`, `skills/`, or `extensions/`, and when mapping another tool's prompts or skills into Pi's native configuration surface.
author: alexgorbatchev
---

# Pi Config

- Prefer Pi's native configuration surface over wrapper layers.
- Use `~/.pi/agent/` for user-global defaults such as `settings.json`, `models.json`, and auth.
- Use project-local `.pi/` for repository-specific settings, prompts, skills, extensions, and appended system instructions.
- Use `APPEND_SYSTEM.md` for additive persona or repo guidance. Use `SYSTEM.md` only when intentionally replacing Pi's built-in system prompt.
- Put reusable slash prompts in `prompts/*.md`. Pi loads them by filename as prompt templates.
- Put Agent Skills bundles in `skills/<name>/SKILL.md`.
- Keep prompt templates flat unless settings or a Pi package manifest explicitly adds nested prompt directories.
- Treat `models.json` as a user-global provider and model registry. Do not check secrets or machine-specific provider endpoints into a shared repository.
- Pi also discovers `.agents/skills/` up the repository tree. Prefer `.pi/skills/` when the config is intentionally Pi-specific, and `.agents/skills/` only when the skill should be shared across multiple agent runtimes.

## Translation Rules

When translating another harness into Pi:

1. Map Markdown commands to `prompts/`.
2. Map skill bundles to `skills/`.
3. Map additive persona text to `APPEND_SYSTEM.md`.
4. Reject unsupported permission or tool-policy models instead of silently dropping them.

Do not invent Pi package manifests unless distribution across multiple repositories is required. For single-repository configs, direct `.pi/` resources are simpler and match Pi's runtime discovery model.
