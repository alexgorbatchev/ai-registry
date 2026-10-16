# @alexgorbatchev/template-resolver

Render trusted repository text with [EJS](https://ejs.co/docs/), retaining the original source filenames.

```ts
import { renderTemplate } from "@alexgorbatchev/template-resolver";

const content = await renderTemplate({
  content: 'Root: <%- repo_root %>\n<%- env("MODE", "development") %>',
  sourcePath: "/repo/prompt.md",
  repositoryRoot: "/repo",
  variables: { repo_root: "/repo" },
  environment: {},
});
```

Use `<%- value %>` for raw text, `<%= value %>` for HTML escaping, and `<% code %>` for JavaScript control flow. Emit a literal opening delimiter with `<%%`. Foreign curly-brace syntax remains unchanged.

EJS resolves relative includes against the original source filename. Use `<%- include("/system/system.md") %>` for repository-root-relative inclusion. Resolved includes outside the repository fail. Nested includes retain the original `file_path` and `file_dir` locals.

The `env(name, fallback?)` helper reads only the supplied environment. Missing values without a fallback throw; empty strings remain valid. Undefined locals, invalid JavaScript, and failed includes report EJS source context. Circular includes fail through EJS's recursion error.

Render each file once. Templates execute JavaScript and must come from trusted sources.
