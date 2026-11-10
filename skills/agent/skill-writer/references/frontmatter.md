## Fields

Use YAML frontmatter with `name`, `description`, `author`, and, in this registry, `metadata`.

- `name`: lowercase kebab-case matching the skill directory.
- `description`: positive conditions that select the skill: requested actions, artifacts or domains, and relevant frameworks or user phrases. Put all trigger information here, not only in the body. Keep exclusions, negative guardrails, commands, validation, and procedures in the body. Do not use the description as a contents summary.
- `author`: preserve existing attribution; use `alexgorbatchev` for new registry-owned skills.
- `metadata.created_on`: creation time, set once.
- `metadata.last_modified`: update on every skill revision.
- `metadata.status`: `current` for active guidance or `archived` for superseded guidance.

Use strict `YYYY-MM-DD HH:MM` timestamps. Verify the current time in the user's stated timezone before writing; otherwise verify the machine's local timezone. Ask if the local timezone cannot be established. Do not silently use UTC or convert historical timestamps whose timezone is unknown.

The validator also permits `license`, `allowed-tools`, and `disable-model-invocation`. Add them only when needed and permitted by repository conventions. In this registry, user skills omit `disable-model-invocation` in source; generation injects it. Preserve required upstream invocation metadata.

## Description

Use the pattern `Use when [actions] [artifacts or domains], including [positive trigger conditions].` For example: `Use when writing, refactoring, or reviewing Go code in .go files.`

Exclude forms such as `Do not use for`, `Not for`, or `Except when`, including exclusions inside parentheses. Preserve all necessary trigger conditions when shortening the text. Project-local addenda use the dependency trigger specified in the addendum reference routed from `SKILL.md`.
