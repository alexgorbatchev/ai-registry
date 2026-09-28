# README Contract

This file is the single source of truth for `README.md` structure, tone, and content in every repository. Read it first, then read the one variant file that matches the project:

- **CLI tools and terminal programs** — `readme-cli.md`
- **Libraries, packages, services, and applications** — `readme-library.md`

Variant files carry only what genuinely differs: installation, usage, and the options table. Everything on this page applies to both. Never restate these rules in a variant file, another skill, or a project.

---

## Authoring Rules

- **Present-State Only**: Describe what the project does today, in present tense. A README is not a changelog, a PR summary, or a record of what an assistant just did.
- **Grounded in Verified Code**: Verify every command, flag, default, path, prerequisite, and version against manifests, source, and `--help` output before writing it. Never infer a feature from a filename.
- **Audience and Value First**: The opening paragraph states what the project does, who it is for, and the problem it solves, with no redundant header above it.
- **Copy-Pasteable**: Every command and snippet runs as written, with realistic arguments and realistic output.
- **Naming Consistency**: Pick one canonical name from the source and use it everywhere, wrapped in backticks. Do not alternate between repo slug, package name, and command or import name.
- **Contributor Guidance Stays Out**: Build-from-source steps, test commands, and release procedures belong in `AGENTS.md` or contributor docs, not in the README.

---

## Section Order

Every README uses this order. Sections marked with `*` are defined by the variant file.

1. **Intro paragraph** — one to three sentences, no header above it.
2. `# What It Does` — bulleted feature highlights, active voice, bold descriptive prefix per bullet.
3. `# How It Works` — the user-facing walk-through.
4. `# How it Really Works` — the same story in depth.
5. `# Prerequisites` — external runtime requirements with links. Omit when there are none.
6. `# Installation` `*`
7. `# Quick Start` `*`
8. `# Options & Flags` or `# Configuration` `*`
9. *Optional domain sections* — for example `# Supported Providers`, `# Advanced Usage`.
10. `# License` — always last, one line, linking the `LICENSE` file.

---

## The Two `How It Works` Sections

Both describe the program, not the codebase.

`# How It Works` is the plain-language walk-through of what the project does with the user's input, from what they hand it to what they get back.

`# How it Really Works` is the same story in depth and still told from outside the program: the services it calls and what it sends them, what it reads and writes and where, what it costs, what work it skips, and the trade-offs behind behavior the user can observe.

**It is deeper, not more internal.** Every bullet must be something a user could confirm by running the code and looking at the result, and must change how they use or trust the project. A detail that could be swapped for a different implementation without the user noticing does not belong in a README. Never document which framework or libraries the project is built on, how its commands, packages, modules, or types are laid out, or how help output, argument parsing, or dependency injection are implemented. That belongs in the source and in contributor docs. Cover the few points that matter rather than every mechanism the code contains.

| Wrong (describes the assembly) | Right (describes the program) |
| :--- | :--- |
| Commands are built on Cobra with a subject-verb hierarchy (`db backup`, `db restore`), rendered as aligned command trees. | Backups land in `$XDG_DATA_HOME/mytool/backups`, one file per run, and are never pruned automatically. |
| Uploads stream through backpressure-aware buffers in a worker pool. | An interrupted upload resumes from the last committed chunk, so a failed run never re-sends what already arrived. |
| Responses are stored in a JSON envelope keyed by a SHA-256 digest computed in `internal/cache`. | The same file is recognised across runs by its contents, so renaming it still hits the cache and is never billed twice. |

---

## Banned Changelog Tone

Never write `now supports`, `recently added`, `this change adds`, `updated to support`, `used to`, `with this update`, `no longer requires`, or conversational filler. Release history belongs in `CHANGELOG.md`, release notes, or commit messages.

| Banned Changelog Phrasing | Correct Current-State Phrasing |
| :--- | :--- |
| "The tool now supports YAML configuration." | "The tool reads configuration from `config.yaml`." |
| "This update adds a `--watch` flag for local development." | "Use `--watch` to rebuild on file changes." |
| "Users previously had to edit the config by hand, but now the CLI does it." | "The CLI updates the configuration file in place." |

---

## Editing An Existing README

- Preserve structure that still works; do not rewrite for the sake of rewriting.
- Delete stale text instead of appending a correction beneath it.
- Rewrite the surrounding paragraphs so the whole document reads in one voice, with no trace of the edit (`now`, `new`, `after this change`).

---

## Final Checklist

- [ ] Intro paragraph states purpose, audience, and problem solved, with no header.
- [ ] Sections appear in the order above, ending with `# License`.
- [ ] `# How It Works` and `# How it Really Works` describe the program, never the framework, module layout, or internal types.
- [ ] Every command, flag, default, and path is verified against source.
- [ ] No changelog phrasing, promotional filler, or assistant narration.
- [ ] One canonical project name, backticked, used consistently.
- [ ] The matching variant file's rules and template were followed.
