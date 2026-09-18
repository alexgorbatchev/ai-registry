# Issue Anatomy

Section-by-section structure for the two issue types, with the reasoning behind each section. Headings are `##`. Include a section only when it carries something; an empty heading is noise.

---

## Defect Report

### `## Summary`

What the code does, and what goes wrong as a result. Name the function, flag, or setting. Two or three sentences, or a numbered list when one issue covers several related failures of the same mechanism.

> `config.ResolvePlaceholders` returns `("", error)` when a placeholder cannot be resolved, and two call sites in the generate pipeline discard that error. `o.fs.Abs("")` then yields the **current working directory**, so a tracked file whose path contains an unresolvable placeholder silently retargets the operation at wherever the command was run from.

### `## Evidence` or `## Reproduction`

Use **Evidence** when the defect is visible in source. Cite `path/file.ext:line` and quote the offending lines:

````markdown
`pkg/orchestrator/generate_pipeline.go:666` and `:764`:

```go
resolvedFilePath, _ := config.ResolvePlaceholders(state.FilePath, tool.Name, projCfg)
```
````

Then, when the repository handles the same thing correctly somewhere else, show that too and say what it proves:

> A third call site in the same file gets this right (`:231`) … which shows the two-value form is understood and the discard is an oversight rather than a decision.

Use **Reproduction** when the defect is visible at runtime. Give a real transcript, with the surprising lines annotated:

````markdown
```
$ ls -d /tmp/out-relative
/tmp/out-relative                      # created next to the shell
$ ls -d ~/dev/.../relpath/out-relative
No such file or directory              # not next to the config
```
````

Both sections may appear when a defect is worth showing from both sides.

### `## Why it matters`

The consequence in user-visible terms, plus a realistic path to hitting it. This is where a reader decides the priority, so do not skip it for "obvious" bugs.

Name the class of defect when sibling issues share it: "This is the same class of defect as #72, one layer up." Cross-references turn isolated tickets into a pattern a maintainer can fix once.

### `## Expected behavior`

One paragraph stating the requirement. Write what the system must do, not what it should stop doing:

> An unresolvable placeholder in a tracked file path fails the generate run, naming the tool, the setting and the token, rather than silently operating on a path the user did not write.

### `## Suggested direction`

The shape of the fix, the trade-off if there is one, and the test that should cover it. Be specific about the test's assertions:

> Cover it with a generate-pipeline test using a tracked file path containing an unknown placeholder, asserting a non-zero result naming the token, and asserting that nothing is created in the working directory.

Do not write the patch. The issue argues the case; the pull request implements it.

### `## Related`

Issue numbers, and how they relate: "Found while fixing #72."

---

## Enhancement Or Proposal

### `## Motivation`

What is awkward today, shown in code rather than described. Quote the current, working-but-verbose form so the cost is concrete:

````markdown
```typescript
install("github-release", { repo: "BurntSushi/ripgrep" })
  .bin("rg")
  .zsh((shell) => shell.env({ RIPGREP_CONFIG_PATH: "$HOME/.ripgreprc" }));
```
````

Then state the general case: most users want this across every shell, and today that means duplicating the block three times.

### `## Proposed Solution`

The API or behavior being added, in one or two paragraphs. Say explicitly what keeps working unchanged, so the proposal reads as additive rather than as a breaking redesign.

### `## Example Usage`

The code as it would read after the change, complete enough to compile in a reader's head: imports, construction, and the new call alongside an existing one.

### `## Proposed Changes`

A numbered list, one entry per file, each naming what changes there. Always include tests and documentation as their own entries:

```markdown
1. **`pkg/vm/dsl-types.ts`**: Add `shell(cb: ShellCallback): this;` to `IToolConfigBuilder`.
2. **`pkg/vm/loader-api.ts`**: Dispatch configurator operations to `zsh`, `bash`, and `powershell`.
3. **Tests**: Verify calls inside `.shell()` populate all three shell configs.
4. **Documentation**: Update the shell-integration and core-api references.
```

An enhancement without a changes list is a wish. The list is what makes it actionable.
