# AGENTS.md structure options

Select sections from verified repository needs; omit empty sections and replace placeholders. These structures supply no policies or permissions. Follow the preservation workflow in [AGENTS.md authoring](../references/agents.md).

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
```

For a root file, include shared commands and constraints and route specialized work to nested instructions or references. For a nested file, include only local differences and requirements. Add technical sections when exact contracts or provenance need them; do not force all content into this skeleton. Include a real example only when it resolves an ambiguity.
