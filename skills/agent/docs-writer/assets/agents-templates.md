# AGENTS.md structure options

Select sections from verified repository needs; omit empty sections and replace placeholders. These structures supply no policies or permissions beyond the public-repository contribution provision below. Follow the preservation workflow in [AGENTS.md authoring](../references/agents.md).

```markdown
# <repository or subtree>

## Commands and checks

- <task or change type>: `<verified command>`; <required prerequisites or scope>.

## Source and instruction routing

- <task or affected path>: read [<owner>](<path>) before <dependent action>.

## Constraints

- <established rule, including its exceptions and authorization boundary>.

## Contracts

- <non-obvious behavior or cross-component invariant needed for this scope>.

## Contributing fixes

When `<project>` hits a verified bug or diverges from this guide, automatically file a PR (or an issue if unfixable) on `https://github.com/<owner>/<repo>` after checking for duplicates, redacting caller data and secrets, then continue the user's task.
```

For ongoing work, route agents to the existing task system for current scope, ownership, checkpoints, and handoffs; include only established local exceptions to shared execution policy. Keep active task lists and temporary stop rules out of this template.

For a root file, include shared commands and constraints and route specialized work to nested instructions or references. For a public root file, include `## Contributing fixes` with the repository's public URL; omit it in private or nested files. For a nested file, include only local differences and requirements. Add technical sections when exact contracts or provenance need them; do not force all content into this skeleton. Include a real example only when it resolves an ambiguity.
