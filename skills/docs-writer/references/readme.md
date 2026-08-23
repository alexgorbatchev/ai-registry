# Project README Guidelines

Write and maintain evergreen, high-clarity `README.md` documentation for repository users and contributors. A README is the primary entry point for a project; it must describe the project's present state accurately and concisely, not narrate historical diffs, changelogs, PR summaries, or assistant actions.

## Core Principles

- **Present-State Only:** Describe what the project does today in present tense. Never write changelog narrative (e.g., `now supports`, `recently added`, `with this update`, `previously`).
- **Grounded in Verified Code:** Read manifests, source code, CLI flags, configuration files, scripts, and tests. Verify all commands, flags, configuration paths, prerequisites, and version constraints directly against repository source files. Never invent commands, flags, or features from filenames alone.
- **Audience & Value First:** State the project purpose, value proposition, and intended audience immediately in the opening section.
- **Copy-Pasteable Executables:** Every CLI command, configuration snippet, and code example must be runnable and complete with realistic arguments and sample outputs.
- **Naming Consistency:** Pick one canonical product/CLI name from source materials and use it consistently throughout the document. Wrap CLI tool names in backticks (`<command>`). Do not alternate casually between repo slug, package name, and CLI command name.
- **Separate Contributor Guidance:** Keep developer/contributor workflows distinct from end-user setup.

---

## Standard Section Layout

Structure project README files using the standard layout defined in `assets/readme-template.md`:

1. **Title & Value Proposition:**
   - Single top-level `# <project-name>` header.
   - One-sentence pitch defining what the tool does, who it is for, and the core problem it solves.
2. **Intended Audience / Disclaimer (Optional):**
   - Use a blockquote callout (`> **⚠️ ...**`) when legal notices, safety warnings, audience boundaries, or critical assumptions are essential.
3. **What It Does:**
   - Bulleted list of 4–6 core capabilities in active voice with bold descriptive prefixes.
4. **How It Works:**
   - Numbered step-by-step pipeline illustrating the end-to-end lifecycle (e.g., Search -> Select -> Download -> Inspect -> Output).
5. **Prerequisites:**
   - Bulleted list of required binary tools, system dependencies, or minimum language runtimes with version requirements and official links.
6. **Installation:**
   - Provide the primary release download path, package manager command, or build-from-source steps. Show the shortest successful path first.
7. **Quick Start:**
   - Numbered subsections covering top user workflows.
   - Include realistic terminal output blocks (`Sample Output:`) showing real CLI execution progress and final state.
8. **Options & Flags (or Configuration):**
   - Clean markdown table: `| Flag | Short | Default | Description |`.
   - Document all primary flags, toggle options, and verbose switches.
9. **Supported Integrations / Platforms (Optional):**
   - Explicitly list supported backends, search providers, formats, or external engines.
10. **Development & Contributing (Optional):**
    - Include local development, testing, or contributing instructions only when the repository is intended for external contributors.
11. **License:**
    - Standard one-line license notice linking to the repository's `LICENSE` file.

---

## Workflow

1. **Identify the README Job:**
   - Determine whether you are creating a new README from scratch, restructuring an existing one, or updating sections after code changes.
   - Identify the project type: CLI tool, library, application, service, template, or monorepo package.
2. **Build from Source-of-Truth Materials:**
   - Inspect lockfiles, package manifests (`package.json`, `go.mod`, `Cargo.toml`), task runners (`justfile`, `Makefile`), CLI help commands, and source implementations.
   - If a fact cannot be verified from repository files, omit it or label the uncertainty.
3. **Draft with Starter Template:**
   - Start from `assets/readme-template.md`.
   - Replace placeholders with verified project specifics.
4. **Rewrite Change Descriptions into Product-State Descriptions:**
   - If working from a diff, PR summary, or new feature request, convert it into plain present-tense documentation.
   - Update surrounding sections so the README reads as though it was always designed to describe the current state.
5. **Audit Tone and Naming:**
   - Remove any transition words or assistant commentary.
   - Ensure CLI tool names are exact, uniform, and backticked.
6. **Verify Output Samples:**
   - Ensure sample terminal outputs reflect the real output formatting of the tool.

---

## Banned Changelog Tone

Do not use transitional, diff-oriented, or historical language:

- `now supports`
- `recently added`
- `this change adds`
- `updated to support`
- `used to`
- `with this update`
- `no longer requires` (when the prior requirement is irrelevant to current users)
- conversational filler such as `well, this tool now ...`

Replace those with direct current-state statements:

| Banned Changelog Phrasing | Correct Current-State Phrasing |
| :--- | :--- |
| "The tool now supports YAML configuration." | "The tool supports YAML configuration via `config.yaml`." |
| "This update adds a `--watch` flag for local development." | "Use `--watch` during local development to rebuild on file changes." |
| "Previously, users had to edit the config manually, but now the CLI can do it." | "The CLI updates the config file automatically." |

---

## Historical Information and Migrations

Historical or transition-oriented content belongs outside the general README flow:

- Put release history in `CHANGELOG.md`, release notes, PR descriptions, or commit messages.
- Put upgrade steps in a clearly labeled migration or upgrade section only when genuinely needed for current users.
- If a migration section is required, keep it separate from the overview, install, usage, and feature descriptions.

---

## Editing Existing READMEs

When updating an existing README:

- Preserve useful existing structure unless it is actively hurting clarity.
- Remove stale text instead of appending a corrective sentence beneath it.
- Rewrite surrounding paragraphs so the document reads consistently in one unified voice.
- Do not leave traces of the editing process (e.g., `now`, `new`, `after this change`, `with this update`).

---

## Final Checklist

- [ ] Project title and one-sentence elevator pitch are clear at the very top.
- [ ] What It Does highlights core benefits with active verbs.
- [ ] How It Works clearly explains the end-to-end processing pipeline.
- [ ] Prerequisites list minimum versions and links for all required system binaries.
- [ ] Installation shows the shortest successful path first.
- [ ] Quick Start contains executable command snippets with sample terminal outputs.
- [ ] Options & Flags table documents all flags accurately with defaults.
- [ ] Product naming is consistent across the full document, with CLI tool names written exactly and wrapped in backticks.
- [ ] No changelog, promotional filler, or assistant narration language exists.
- [ ] Follows `assets/readme-template.md` structure.
