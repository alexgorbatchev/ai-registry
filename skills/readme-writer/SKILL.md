---
name: readme-writer
description: Write, rewrite, and update `README.md` files for projects. Use when creating a project README from scratch, tightening an existing README, or updating evergreen documentation after project changes. Ground claims in the available source materials and describe the project as it exists today, not as a narration of what just changed.
author: alexgorbatchev
---

# README Writer

Write README content for current and future users of the repository. A README is evergreen reference documentation for the project's present state, not a changelog, PR summary, or narration of the edit that just happened.

## Workflow

1. Identify the README job.
- Determine whether you are creating a new README, restructuring an existing one, or updating sections after code changes.
- Determine the project type: library, application, CLI, template, API service, or monorepo package.

2. Build from source-of-truth materials.
- Read the existing `README.md` plus the code, package manifests, examples, config files, scripts, tests, and checked-in docs that support the claims you plan to make.
- Do not infer features from filenames alone.
- If a fact cannot be verified, leave it out or label the uncertainty.

3. Choose the smallest section set that fits.
- Common sections: title and value proposition, status or requirements, installation, quick start, usage, configuration, development, contributing, license.
- Add API, architecture, deployment, or troubleshooting sections only when the repository actually needs them.
- Remove stale or duplicative sections instead of layering more prose on top.

4. Write for first-time readers.
- Put the project's purpose and audience near the top.
- Prefer concrete commands, examples, and file paths over abstract claims.
- Keep setup steps ordered and executable.

5. Rewrite change descriptions into product-state descriptions.
- If the input is a diff, PR summary, or request about a newly added capability, convert it into plain present-tense documentation.
- Update surrounding sections so the README reads like it was always intended to describe the current project state.

6. Verify before finalizing.
- Re-check commands, flags, filenames, environment variables, URLs, and version requirements against the repository.
- Remove anything that reads like release notes, implementation commentary, or assistant narration.

## Current-State Rule

These are mandatory for normal README sections:

- Describe capabilities in present tense.
- State what the project does, how to install it, and how to use it without reference to the prior state.
- Treat the README as timeless within the current version of the repository.
- Write from the perspective of a user reading the repository today, not from the perspective of an assistant explaining what changed.

## Banned Changelog Tone

Do not use language like:

- `now supports`
- `recently added`
- `this change adds`
- `updated to support`
- `used to`
- `with this update`
- `no longer requires` when the prior requirement is irrelevant to current users
- conversational filler such as `well, this tool now ...`

Replace those with direct current-state statements.

Bad: "The tool now supports YAML configuration."

Good: "The tool supports YAML configuration via `config.yaml`."

Bad: "This update adds a `--watch` flag for local development."

Good: "Use `--watch` during local development to rebuild on file changes."

Bad: "Previously, users had to edit the config manually, but now the CLI can do it."

Good: "The CLI updates the config file automatically."

## Historical Information

Historical or transition-oriented content belongs outside the general README flow unless the user explicitly needs it.

- Put release history in `CHANGELOG.md`, release notes, PR descriptions, or commit messages.
- Put upgrade steps in a clearly labeled migration or upgrade section when they are genuinely needed for current users.
- If a migration section is required, keep it separate from the overview, install, usage, and feature descriptions.

## Section Guidance

### Overview

- Explain what the project is, who it is for, and why it exists.
- Prefer one clear paragraph plus a short capability list over marketing prose.

### Installation And Quick Start

- Show the shortest successful path first.
- Include prerequisites only when they are real requirements.
- Keep commands copy-pasteable.

### Usage

- Lead with representative examples.
- Explain flags, config files, or inputs only after the reader can see a working example.
- Prefer examples that match checked-in behavior.

### Development Sections

- Only include local development, testing, or contributing instructions when the repository is meant to support contributors.
- Keep contributor guidance distinct from end-user setup.

## Editing Existing READMEs

When updating an existing README:

- Preserve useful structure unless it is actively hurting clarity.
- Remove stale text instead of appending a corrective sentence beneath it.
- Rewrite surrounding paragraphs so the document reads consistently in one voice.
- Do not leave traces of the editing process such as `now`, `new`, `after this change`, or `with this update`.

## Final Checklist

Before finishing, verify:

- The first screen explains the project clearly.
- Every factual claim is grounded in the repository.
- Commands and file paths are valid.
- Section order matches the likely user journey.
- No evergreen section reads like a changelog, PR summary, or assistant note.
