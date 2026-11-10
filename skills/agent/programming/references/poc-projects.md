# POC projects

Enable POC behavior only when the project's root `AGENTS.md` contains this exact line:

```text
POC mode: merge directly to main; skip tests unless requested.
```

When the user requests POC on, add the marker directly below the file's first heading. If the file does not exist, create it with a `# <project name>` heading and the marker. When the user requests POC off, remove the marker. Change nothing else for the toggle and commit it like any other task change.

While the marker is present, apply these overrides:

- Integrate work into `main` directly: commit on `main`, or merge a task branch or worktree into `main` locally, then push. Do not open pull requests. Never force-push or bypass branch protection; report a rejected push.
- Do not write, update, or run tests, and do not apply coverage requirements, unless the user requests tests for the current task. This overrides test and coverage rules in repository and shared guidance. Run the project's other required checks, such as formatting, linting, type checking, and builds.
- Start the `DUE DILIGENCE` section with this exact unnumbered line, and include the section even when nothing else is reported:

  ```text
  POC: tests and PRs skipped (non-actionable).
  ```

  Do not report missing tests, missing coverage, or skipped pull requests as due diligence items.
