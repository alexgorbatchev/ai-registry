# @alexgorbatchev/template-resolver

Recursive text-only template resolver for repository builds.

Supported tags:

- `{{ repo_root }}` style string variables
- `{{ include "path/from/repo/root.txt" }}`
- `{{ env "VAR_NAME" }}`
- `{{ env "VAR_NAME" default "fallback" }}`

Design constraints:

- repo-root-relative includes only
- recursive include expansion with circular-include detection
- no JavaScript execution
- no loops, conditionals, filters, or custom helpers
