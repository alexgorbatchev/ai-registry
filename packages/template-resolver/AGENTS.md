# Template Resolver Package

This package renders trusted repository text with EJS, preserving source filenames.

## Contracts

- Use EJS's native renderer, delimiters, expressions, control flow, escaping, and include mechanism. Do not add a custom template parser or legacy syntax compatibility.
- Pass the original source path as EJS's filename. Keep file_path and file_dir bound to that original file across nested includes.
- Set root and views to the repository root. Use include("/system/system.md") for explicit repository-root-relative includes; relative includes follow EJS filename resolution.
- Reject resolved include paths outside the repository root.
- Expose env(name, fallback?) from the caller-supplied environment. Missing values without a fallback fail; empty strings remain valid.
- Use raw output tags for plain text and paths. Escaped output tags retain native HTML escaping.
- Render each file exactly once. Literal EJS opening delimiters use <%%.
- Treat templates as trusted JavaScript code. Curly-brace syntax belongs to other tools and passes through unchanged.
- Sync-back supports canonical raw path-variable tags only. Edit expressions, includes, and control flow at their source.

## Validation

- Run bun test packages/template-resolver and bun test packages/registry-cli from the repository root.
- Run bun run build after resolver behavior changes and inspect generated outputs.
- Change behavioral tests with code behavior; maintain at least 90% coverage.
