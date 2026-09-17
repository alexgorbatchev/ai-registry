# @alexgorbatchev/template-resolver

Recursive text-only template resolver for repository builds.

Supported tags:

- `{{ repo_root }}` style string variables
- `{{ file_path }}` for the original source file path of the file being rendered
- `{{ file_dir }}` for the original source file directory of the file being rendered
- `{{ include "path/from/repo/root.txt" }}`
- `{{ env "VAR_NAME" }}`
- `{{ env "VAR_NAME" default "fallback" }}`

Escaping:

- a single backslash directly before a tag emits it literally and is consumed:
  `\{{args}}` renders `{{args}}`
- earlier backslashes pass through, so `\\{{args}}` renders `\{{args}}`
- use this when text must document foreign templating syntax, such as justfile
  interpolation or Go templates, that would otherwise look like a supported tag
- render each file only once; a second pass resolves a tag whose escape the first
  pass already consumed

Design constraints:

- repo-root-relative includes only
- recursive include expansion with circular-include detection
- no JavaScript execution
- no loops, conditionals, filters, or custom helpers
