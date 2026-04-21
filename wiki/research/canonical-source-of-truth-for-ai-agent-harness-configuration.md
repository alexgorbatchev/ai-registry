# Research: Canonical Source of Truth for AI Agent Harness Configuration

Created: 2026-04-15
Last updated: 2026-04-15

## Original Prompt

> Research online thoroughly on the best way for a software developer working with AI agent harnesses to store and organize skill files, configuration, common commands, and agent configuration so that there is one canonical source of truth. Focus on how to bootstrap multiple agent harnesses from that source across machines, ideally by pulling one repo and using it everywhere.
>
> You should:
> - Search broadly across the web, including relevant articles, documentation, blog posts, and YouTube video summaries.
> - Identify common patterns and best practices.
> - Create a rating system from 1 to 10 for the approaches you find.
> - Include cited sources inline wherever they are referenced.
> - Generate a comprehensive `research.md` file.
> - Make the research exhaustive and detailed.

## Executive Summary

The best practical pattern today for a developer using multiple AI agent harnesses across multiple machines is a hybrid model:

1. Keep one version-controlled canonical repo for your personal and team-wide agent configuration.
2. Keep project-specific truth in each project repo, preferably in a small root `AGENTS.md` plus any local skills/rules that truly belong to that project.
3. Generate harness-specific files from the canonical repo rather than maintaining `CLAUDE.md`, `.cursor/rules`, `.github/copilot-instructions.md`, Codex/OpenCode skills, and other tool-specific files by hand ([OpenAI Codex skills docs](https://developers.openai.com/codex/skills), [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md), [GitHub Copilot docs](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions), [OpenCode rules docs](https://opencode.ai/docs/rules/), [agent-harness README](https://github.com/madebywild/agent-harness)).
4. Bootstrap that repo across machines with a provisioning layer. For most developers, `chezmoi` is the best fit because it combines one-command init, templating, machine-specific overrides, secret integration, and cross-platform support ([chezmoi docs](https://www.chezmoi.io/)). For simpler setups, GNU Stow is excellent. For maximum reproducibility, Nix/Home Manager is stronger but heavier ([GNU Stow manual](https://www.gnu.org/software/stow/manual/stow.html), [Home Manager manual](https://nix-community.github.io/home-manager/)).
5. Put always-needed repository context in a small, stable, always-loaded file such as `AGENTS.md`, and keep specialized workflows in modular skills/rules so context stays small and reusable ([Claude Code memory docs](https://code.claude.com/docs/en/memory), [Cursor rules docs](https://cursor.com/docs/rules), [Vercel AGENTS.md evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)).
6. Treat prompts as guidance and hooks/tests/permissions as enforcement. If something must never happen, do not rely on prose alone ([Claude Code docs](https://code.claude.com/docs/en/memory), [Matt Pocock video](https://www.youtube.com/watch?v=3CSi8QAoN-s)).

Short version: the highest-scoring approach is **canonical registry repo + project `AGENTS.md` + generated harness outputs + `chezmoi` or Nix bootstrap**.

## Short Answer

If the goal is "pull one repo and use it everywhere," the strongest design is:

1. A personal or team `ai-registry` repo that stores reusable global assets:
   `skills/`, `commands/`, `agents/`, `prompts/`, `mcp/`, `hooks/`, `profiles/`, generator scripts, and bootstrap automation.
2. A project-local `AGENTS.md` in each codebase that stores repo-specific truth: build/test/lint commands, architecture, local conventions, and pitfalls ([AGENTS.md](https://agents.md/), [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md), [Harness blog](https://www.harness.io/blog/the-agent-native-repo-why-agents-md-is-the-new-standard), [Lukas Masuch](https://lukasmasuch.com/blog/the-repo-is-the-harness/)).
3. An adapter layer that emits the right files for each harness:
   `CLAUDE.md`, `.claude/skills`, `.cursor/rules`, `.github/copilot-instructions.md`, `.github/prompts`, `.agents/skills`, `.opencode/commands`, `.aider.conf.yml`, and so on ([GitHub Copilot docs](https://docs.github.com/en/copilot/concepts/prompting/response-customization), [OpenCode commands docs](https://opencode.ai/docs/commands/), [Aider conventions docs](https://aider.chat/docs/usage/conventions.html)).
4. A distribution layer that installs the repo, links or renders outputs, injects secrets, and keeps machines in sync ([chezmoi docs](https://www.chezmoi.io/), [Missing Semester dotfiles guide](https://missing.csail.mit.edu/2019/dotfiles/)).

This beats every other approach because it is the only one that simultaneously minimizes drift, supports multiple harnesses, stays version-controlled, remains context-efficient, and can be rehydrated onto a new machine quickly.

## Rating System

Each approach below is rated from 1 to 10 against seven weighted criteria:

| Criterion | Weight | What it measures |
| --- | ---: | --- |
| Single source of truth | 20% | Whether there is one canonical place to edit agent config |
| Multi-harness support | 20% | How well the approach spans Claude, Cursor, Copilot, Codex, OpenCode, Aider, etc. |
| Cross-machine bootstrap | 15% | How easy it is to clone/apply on a new machine |
| Drift resistance | 15% | How well it prevents tool-specific divergence |
| Context efficiency | 10% | Whether it supports small always-on context with modular add-ons |
| Secrets and local overrides | 10% | Whether it handles per-machine and per-user differences safely |
| Operational overhead | 10% | Complexity, maintenance load, and developer ergonomics |

Scores are practical, not theoretical. A 10/10 approach is not the simplest possible system. It is the best tradeoff for real multi-harness usage in 2026.

## Approach Ratings

| Approach | Score | Why it scores this way |
| --- | ---: | --- |
| Scattered per-tool files in home directories | 2/10 | Fast to start, terrible for drift, sharing, auditability, and machine setup. Every harness becomes its own island. |
| One repo, but manually maintained per-tool files | 4/10 | Better because at least Git sees changes, but you still duplicate the same instruction logic into multiple formats by hand. |
| Single root `AGENTS.md` only | 6/10 | Strong baseline for project truth and broad compatibility, but insufficient by itself for modular workflows, commands, MCP config, profiles, and non-AGENTS-native tools ([AGENTS.md](https://agents.md/), [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)). |
| Skills/rules library only | 5/10 | Good modularity, but weak as the only carrier of core repo context. Skills depend on reliable invocation, and several sources show that this is not always dependable ([Vercel evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals), [OpenAI blog](https://developers.openai.com/blog/skills-agents-sdk)). |
| Dotfiles repo + GNU Stow | 7/10 | Excellent for symlink-based distribution and Git-backed portability, but weaker on secrets, templating, and heterogeneous machine differences ([GNU Stow manual](https://www.gnu.org/software/stow/manual/stow.html), [Josean Martinez video](https://www.youtube.com/watch?v=06x3ZhwrrwA), [Typecraft video](https://www.youtube.com/watch?v=NoFiYOqnC4o)). |
| Dotfiles repo + `chezmoi` | 8.5/10 | The best general-purpose bootstrap layer for most developers: one-command init, machine-specific templates, secret-manager integration, encryption, and multi-OS support ([chezmoi docs](https://www.chezmoi.io/), [Tom Payne video](https://www.youtube.com/watch?v=JrCMCdvoMAw)). |
| Declarative Nix/Home Manager | 8.5/10 | Strongest reproducibility and excellent for "whole environment as code," but steeper learning curve and less approachable for most teams ([Home Manager manual](https://nix-community.github.io/home-manager/)). |
| Canonical registry + generated harness outputs | 9.5/10 | Best direct solution for multi-harness config drift. The only significant missing piece is machine bootstrap and secret injection ([agent-harness README](https://github.com/madebywild/agent-harness), [Corey Daley](https://coreydaley.dev/posts/2026/02/centralizing-ai-agent-configurations-with-artificial-intelligence-repo/), [OpenSite post](https://dev.to/opensite/one-repo-every-ai-agent-zero-drift-introducing-the-opensite-skills-library-2k3g)). |
| **Canonical registry + generated outputs + bootstrap layer** | **10/10** | Best overall. Version-controlled, multi-harness, anti-drift, portable, modular, and practical across machines. This is the architecture I would recommend building. |

## What the Sources Strongly Agree On

### 1. The repository must become agent-native

The strongest recent writing on this topic says the same thing in different words: the problem is usually the repo, not the model. Lukas Masuch puts it bluntly: "the GitHub repo is the single source of truth - code, docs, specs, rules, and automation all live together in one place" ([Lukas Masuch](https://lukasmasuch.com/blog/the-repo-is-the-harness/)). Harness makes the same argument: agent quality collapses when instructions live in tool-specific silos rather than in the repository ([Harness blog](https://www.harness.io/blog/the-agent-native-repo-why-agents-md-is-the-new-standard)). OpenAI's Codex guidance similarly treats `AGENTS.md` as repo-level context that should load before work begins ([OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)).

Implication: if the canonical source of truth is not under version control and close to the code, it is already too fragile.

### 2. Always-needed context should live in a small root instruction file

Claude Code docs recommend using `CLAUDE.md` for persistent facts that matter in every session and explicitly warn that large files consume context and reduce adherence ([Claude Code memory docs](https://code.claude.com/docs/en/memory)). The docs recommend under 200 lines, and J.D. Hodges independently reaches almost the same rule of thumb and says to keep `CLAUDE.md` under 200 lines and use `settings.json` for enforcement instead ([J.D. Hodges](https://www.jdhodges.com/blog/claude-code-claudemd-project-instructions/)).

OpenAI Codex makes the same design point for `AGENTS.md`: it is the always-loaded instruction chain and should contain project expectations, commands, and local guidance that matter at startup ([OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)).

Vercel's Next.js evals go further: when they tested a compressed docs index embedded in `AGENTS.md`, it outperformed skills for general framework knowledge because the context was present on every turn without requiring a skill invocation decision ([Vercel evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)).

Implication: every project should have a small root `AGENTS.md` or equivalent canonical base file, regardless of what else you build.

### 3. Modular skills and rules are still necessary, but not as the only layer

OpenAI's Codex skills docs define skills as reusable workflow packages with progressive disclosure: metadata loads first, full `SKILL.md` loads only when relevant, and scripts/references load only as needed ([Codex skills docs](https://developers.openai.com/codex/skills), [Agent Skills specification](https://agentskills.io/specification)). OpenAI's OSS maintenance blog shows the best-known real-world pattern today: use `AGENTS.md` for mandatory triggers and repo-wide rules, then use small narrow skills for reusable workflows such as verification, docs sync, release review, and PR drafting ([OpenAI blog](https://developers.openai.com/blog/skills-agents-sdk)).

Claude Code docs make a similar split: use `CLAUDE.md` for persistent facts and `.claude/rules/` or skills for scoped or on-demand guidance ([Claude Code memory docs](https://code.claude.com/docs/en/memory)). Cursor's rules docs also recommend focused, composable rules instead of one giant file, and path scoping with frontmatter or globs ([Cursor rules docs](https://cursor.com/docs/rules)).

Implication: the winning model is not `AGENTS.md` instead of skills, or skills instead of rules. It is a layered stack: small always-on repo instructions plus modular workflow packs.

### 4. Path-scoped instructions are the right way to localize complexity

Claude Code supports `.claude/rules/` files with `paths` frontmatter, loaded only when matching files are involved ([Claude Code memory docs](https://code.claude.com/docs/en/memory)). Cursor supports `.cursor/rules/*.mdc` with descriptions and globs for selective application ([Cursor rules docs](https://cursor.com/docs/rules)). GitHub Copilot supports path-specific `NAME.instructions.md` files under `.github/instructions` with `applyTo` glob patterns ([GitHub Copilot docs](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions)).

Implication: do not solve codebase complexity with a massive root file. Solve it with path-scoped, subsystem-scoped instruction modules.

### 5. Prompts are guidance; hooks, tests, linting, and permissions are enforcement

This is one of the clearest consistent themes across sources. Claude Code docs separate guidance (`CLAUDE.md`) from client-side enforcement (`settings.json`, hooks, permissions) ([Claude Code memory docs](https://code.claude.com/docs/en/memory)). OpenCode has the same split: prompts, commands, and agents are configurable, but permissions determine what can actually run ([OpenCode agents docs](https://opencode.ai/docs/agents/), [OpenCode commands docs](https://opencode.ai/docs/commands/)). Matt Pocock's video is the most direct practical formulation of this idea: if you must force a behavior such as "use pnpm, not npm," do not rely only on `CLAUDE.md`; block the wrong command with a hook and let the model recover deterministically ([Matt Pocock video](https://www.youtube.com/watch?v=3CSi8QAoN-s)).

Lukas Masuch describes the same thing at repo level: tighter linting, formatting, type checks, `make check`, and hooks were necessary to make agents productive in a mature codebase ([Lukas Masuch](https://lukasmasuch.com/blog/the-repo-is-the-harness/)).

Implication: the canonical repo should store both narrative guidance and executable enforcement assets.

### 6. Cross-machine distribution should be automated, not manual

The MIT Missing Semester dotfiles guide still captures the simplest durable truth: keep config in its own version-controlled folder and symlink it into place with a script so installation, portability, synchronization, and history all work ([Missing Semester](https://missing.csail.mit.edu/2019/dotfiles/)). GNU Stow formalizes the symlink-farm pattern and remains a strong low-complexity option ([GNU Stow manual](https://www.gnu.org/software/stow/manual/stow.html)).

But for most developers managing multiple machines and AI harnesses, `chezmoi` is more capable. It adds templating, machine-to-machine differences, secret manager support, encryption, and a one-command `init --apply` flow ([chezmoi docs](https://www.chezmoi.io/)). The dotfiles video set strongly reinforces this. The Stow videos emphasize simplicity and transparency ([Josean Martinez](https://www.youtube.com/watch?v=06x3ZhwrrwA), [Typecraft](https://www.youtube.com/watch?v=NoFiYOqnC4o), [Dreams of Autonomy](https://www.youtube.com/watch?v=y6XCebnB9gs)), while the `chezmoi` videos emphasize the value of templating, secrets, and multi-machine variance ([Tom Payne](https://www.youtube.com/watch?v=JrCMCdvoMAw), [Let's Code / chris biscardi](https://www.youtube.com/watch?v=L_Y3s0PS_Cg), [sudopluto](https://www.youtube.com/watch?v=id5UKYuX4-A)).

Implication: the canonical repo should not stop at source files. It needs a reproducible install/apply path.

### 7. There is strong momentum toward open, harness-neutral file standards

`AGENTS.md` is now explicitly positioned as a tool-agnostic instruction layer and claims support across a large and growing tool ecosystem, including Codex, Aider, OpenCode, Cursor, VS Code/Copilot, and others ([AGENTS.md](https://agents.md/)). OpenCode explicitly supports `AGENTS.md` as its main rules format and even falls back to Claude-compatible files for migration scenarios ([OpenCode rules docs](https://opencode.ai/docs/rules/)). GitHub Copilot docs now recognize `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` as agent instruction files in addition to `copilot-instructions.md` and path-specific instruction files ([GitHub Copilot docs](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions)).

Implication: the safest portable base today is to author the project layer in a harness-neutral format such as `AGENTS.md`, then adapt outward where necessary.

## Where the Sources Disagree

### AGENTS.md versus skills

This is the biggest disagreement.

- OpenAI and Anthropic-oriented sources argue for a layered system: always-on root instructions plus skills for repeatable workflows ([OpenAI blog](https://developers.openai.com/blog/skills-agents-sdk), [Codex skills docs](https://developers.openai.com/codex/skills), [Anthropic skills video](https://www.youtube.com/watch?v=fOxC44g8vig)).
- Vercel's evals found that for general framework knowledge, `AGENTS.md` significantly outperformed skills because the agent did not have to decide whether to invoke a skill ([Vercel evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)).

My conclusion: use `AGENTS.md` for always-needed framework and repo knowledge. Use skills for reusable workflows, checklists, and deeper domain modules. Do not make skills the only place where core project truth lives.

### One big file versus many small files

The tools all support some version of modularity, but not everyone likes hierarchical or nested file discovery. Blake Niemyjski explicitly recommends a single root `AGENTS.md` plus skills instead of complex nested `AGENTS.md` hierarchies because multi-level precedence gets hard to reason about ([Blake Niemyjski](https://blakeniemyjski.com/blog/agentic-driven-development/)). The AGENTS.md site, Codex, Cursor, Claude, and GitHub docs all support nested or path-scoped guidance in some form ([AGENTS.md](https://agents.md/), [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md), [Cursor rules docs](https://cursor.com/docs/rules), [GitHub Copilot docs](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions)).

My conclusion: keep the root file small, but use modular secondary files only when the scoping is obvious and stable.

### Symlinks versus rendered/copied files

Stow and many dotfiles workflows prefer symlinks for visibility and live editing ([GNU Stow manual](https://www.gnu.org/software/stow/manual/stow.html), [GeekMasher video](https://www.youtube.com/watch?v=OHR0v0jrDik)). `chezmoi` often prefers rendered real files in the home directory because that preserves permissions, supports templating/encryption more naturally, and makes migration easier later ([chezmoi docs](https://www.chezmoi.io/), [Tom Payne video](https://www.youtube.com/watch?v=JrCMCdvoMAw)).

My conclusion: use symlinks for generated harness outputs only if the target tool behaves well with them and your team wants live-edit visibility. Otherwise render/copy generated files.

## Recommended Architecture

## Two Layers of Truth

The best design is not literally "one file for everything." It is **one canonical repo for reusable harness configuration** plus **one canonical project file per codebase**.

### Layer A: personal or team harness registry repo

This repo should contain:

- Global defaults and personas
- Reusable skills and reusable commands
- Harness profiles such as `default`, `reviewer`, `planner`, `docs`, `security`
- MCP definitions, hook scripts, and permission policies
- Generator code that emits tool-specific files
- Bootstrap automation for new machines

This is the thing you clone onto every machine.

### Layer B: per-project repo truth

Each project repo should contain:

- A small root `AGENTS.md`
- Any genuinely project-specific skills or path-scoped rules
- Build, test, lint, and validation commands
- Architecture notes, specs, and local conventions

This is the thing that answers: "How does this repository work?" Your personal registry repo should not try to own this.

## Why this split matters

Project-specific truths change with the codebase and should live with the code. Personal reusable workflows change with your preferred harness stack and should live in your canonical harness repo. Mixing them leads to the wrong kind of centralization: one repo becomes bloated with project facts that do not belong globally.

## Layered Design Pattern

### Layer 1: always-on project guidance

Keep a concise root `AGENTS.md` in each project. Include:

- Project purpose and stack
- Build, test, lint, format, and verification commands
- Command order when it matters
- Non-obvious architecture boundaries
- Repo-specific pitfalls and prohibited patterns

This is the high-frequency context the agent should see every session ([OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md), [Claude Code docs](https://code.claude.com/docs/en/memory), [AGENTS.md](https://agents.md/)).

### Layer 2: path-scoped or subsystem guidance

Add subsystem-specific instructions only when they are stable and important enough to justify their own file. Use the harness-native mechanism for each tool:

- Claude Code: `.claude/rules/*.md` with `paths` ([Claude Code docs](https://code.claude.com/docs/en/memory))
- Cursor: `.cursor/rules/*.mdc` with globs ([Cursor rules docs](https://cursor.com/docs/rules))
- Copilot: `.github/instructions/*.instructions.md` with `applyTo` ([GitHub Copilot docs](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions))
- AGENTS-based tools: nested `AGENTS.md` if needed ([AGENTS.md](https://agents.md/), [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md))

### Layer 3: reusable workflow skills

Use skill folders for workflows that recur across projects or teams:

- code review
- release review
- docs sync
- PR draft generation
- debugging playbooks
- test coverage improvements

Design each skill as a small package with `SKILL.md`, optional `scripts/`, and optional `references/` ([Codex skills docs](https://developers.openai.com/codex/skills), [Agent Skills specification](https://agentskills.io/specification), [OpenAI blog](https://developers.openai.com/blog/skills-agents-sdk)).

### Layer 4: reusable command and prompt assets

Different harnesses expose this differently, but the pattern is converging:

- OpenCode custom commands in markdown ([OpenCode commands docs](https://opencode.ai/docs/commands/))
- Copilot prompt files under `.github/prompts/*.prompt.md` ([GitHub prompt files docs](https://docs.github.com/en/copilot/tutorials/customization-library/prompt-files/your-first-prompt-file))
- Aider read-only conventions files such as `CONVENTIONS.md` loaded via `.aider.conf.yml` ([Aider conventions docs](https://aider.chat/docs/usage/conventions.html), [Aider config docs](https://aider.chat/docs/config/aider_conf.html))

Keep these assets in the registry repo in a canonical format, then emit or reference them per harness.

### Layer 5: enforcement and safety

Store hook scripts, lint/test runner wrappers, permissions, and "doctor" checks in the canonical repo. The repo should be able to answer two questions automatically:

1. Can this machine run the configured harnesses?
2. Are generated outputs current and safe to apply?

Do not depend on prompt adherence for hard safety constraints ([Claude Code docs](https://code.claude.com/docs/en/memory), [Matt Pocock video](https://www.youtube.com/watch?v=3CSi8QAoN-s), [Lukas Masuch](https://lukasmasuch.com/blog/the-repo-is-the-harness/)).

### Layer 6: bootstrap and provisioning

Provide a reproducible install path. At minimum:

- install the repo
- install tool dependencies
- inject secrets or env values
- generate outputs
- link or apply them

For most teams, use `chezmoi` as the outer bootstrap shell around the canonical repo ([chezmoi docs](https://www.chezmoi.io/)). If your environment is already Nix-heavy, use Home Manager ([Home Manager manual](https://nix-community.github.io/home-manager/)).

## Recommended Repository Layout

```text
ai-harness-registry/
├── README.md
├── AGENTS.md
├── global/
│   ├── base.md
│   ├── workflows.md
│   └── security.md
├── skills/
│   ├── code-review/
│   │   ├── SKILL.md
│   │   ├── scripts/
│   │   └── references/
│   ├── release-review/
│   └── docs-sync/
├── rules/
│   ├── frontend.md
│   ├── backend.md
│   ├── testing.md
│   └── security.md
├── prompts/
│   ├── review.prompt.md
│   ├── pr-summary.prompt.md
│   └── migration.prompt.md
├── commands/
│   ├── test.md
│   ├── lint.md
│   └── release.md
├── agents/
│   ├── default.yaml
│   ├── reviewer.yaml
│   ├── planner.yaml
│   └── docs.yaml
├── mcp/
│   ├── docs.yaml
│   ├── browser.yaml
│   └── github.yaml
├── hooks/
│   ├── pre-command-guard.sh
│   └── post-edit-format.sh
├── adapters/
│   ├── claude/
│   ├── cursor/
│   ├── copilot/
│   ├── codex/
│   ├── opencode/
│   └── aider/
├── generated/
│   ├── claude/
│   ├── cursor/
│   ├── copilot/
│   ├── codex/
│   ├── opencode/
│   └── aider/
├── bootstrap/
│   ├── chezmoi/
│   ├── stow/
│   └── home-manager/
└── scripts/
    ├── generate
    ├── apply
    ├── doctor
    └── bootstrap
```

This layout matches the common patterns visible in agent-harness, Corey Daley's `agent-config`, and OpenSite's `opensite-skills`: separate reusable assets from generated tool outputs, and keep distribution mechanics explicit ([agent-harness README](https://github.com/madebywild/agent-harness), [Corey Daley](https://coreydaley.dev/posts/2026/02/centralizing-ai-agent-configurations-with-artificial-intelligence-repo/), [OpenSite post](https://dev.to/opensite/one-repo-every-ai-agent-zero-drift-introducing-the-opensite-skills-library-2k3g)).

## Harness Mapping

The point of the canonical repo is not to force every harness into one abstraction. The point is to generate the right native artifact for each harness.

| Canonical concept | Claude Code | Cursor | GitHub Copilot | Codex / AGENTS-native | OpenCode | Aider |
| --- | --- | --- | --- | --- | --- | --- |
| Always-on project instructions | `CLAUDE.md` or `.claude/CLAUDE.md` | root `AGENTS.md` and/or `.cursor/rules` | `.github/copilot-instructions.md` and optionally `AGENTS.md` | root `AGENTS.md` | root `AGENTS.md` | `read: AGENTS.md` or `CONVENTIONS.md` in `.aider.conf.yml` |
| Path-scoped instructions | `.claude/rules/*.md` with `paths` | `.cursor/rules/*.mdc` with `globs` | `.github/instructions/*.instructions.md` with `applyTo` | nested `AGENTS.md` | `opencode.json` `instructions` and nested `AGENTS.md` | separate read-only convention files |
| Reusable skills | `.claude/skills/...` | project rules or tool-specific skill patterns | prompt files for task-specific reuse | `.agents/skills/...` | built-in skills plus `.opencode/skills` / agents | convention files and CLI composition |
| Custom commands/prompts | tool-specific commands or skills | tool-specific commands/rules | `.github/prompts/*.prompt.md` | workflow skills and commands | `.opencode/commands/*.md` | `.aider.conf.yml`, `/read`, command-line flags |
| Agent personas | `.claude/agents/*.md` | agent/rule composition | agent instructions + prompt files | subagents and AGENTS layering | `.opencode/agents/*.md` | mostly outside aider's core model |

Sources: [Claude Code docs](https://code.claude.com/docs/en/memory), [Cursor rules docs](https://cursor.com/docs/rules), [GitHub Copilot docs](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions), [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md), [Codex skills docs](https://developers.openai.com/codex/skills), [OpenCode rules docs](https://opencode.ai/docs/rules/), [OpenCode agents docs](https://opencode.ai/docs/agents/), [OpenCode commands docs](https://opencode.ai/docs/commands/), [Aider docs](https://aider.chat/docs/usage/conventions.html).

## Bootstrap Strategy Across Machines

## Best default: `chezmoi`

For most developers, the best bootstrap pattern is:

1. `chezmoi` installs or clones the canonical repo.
2. `chezmoi` applies machine-specific variables and secrets.
3. A post-apply script runs `generate` and `apply` for harness outputs.
4. The generated files are linked or rendered into harness-specific locations.

Why `chezmoi` over plain symlinks?

- It handles machine-specific differences cleanly with templates ([chezmoi docs](https://www.chezmoi.io/)).
- It integrates with secret managers and encryption ([chezmoi docs](https://www.chezmoi.io/)).
- It can initialize a brand-new machine in one command ([chezmoi docs](https://www.chezmoi.io/)).
- The video evidence strongly shows it is a better fit than raw symlinks when you have heterogeneous machines and private values ([Tom Payne video](https://www.youtube.com/watch?v=JrCMCdvoMAw), [Let's Code video](https://www.youtube.com/watch?v=L_Y3s0PS_Cg)).

## Simpler fallback: GNU Stow

If you want less machinery and are comfortable with symlinks:

1. Keep generated outputs in the canonical repo.
2. Use Stow to link those outputs into place.
3. Store machine differences in separate files or override directories.

This is easy to understand and audit, but weaker on secrets and templating ([GNU Stow manual](https://www.gnu.org/software/stow/manual/stow.html), [Josean Martinez video](https://www.youtube.com/watch?v=06x3ZhwrrwA)).

## Maximum reproducibility: Nix/Home Manager

If you already use Nix:

1. Declare the canonical repo as an input.
2. Install all required CLIs and shells declaratively.
3. Render generated outputs from declarative config.
4. Manage user home state with Home Manager.

This is the most reproducible setup, but it is not the lowest-friction one for typical teams ([Home Manager manual](https://nix-community.github.io/home-manager/)).

## Secrets and Local Overrides

This is non-negotiable.

Do **not** put the following in the shared canonical repo:

- API keys
- browser session cookies
- private MCP endpoints
- personal SSH identities
- work-only credentials

The safest pattern is:

1. Shared repo stores placeholders and schemas.
2. Secret manager or encrypted local data stores values.
3. Bootstrap step injects values at apply time.

`chezmoi` explicitly supports secret managers, encryption, and machine-specific templating ([chezmoi docs](https://www.chezmoi.io/)). The `OpenSite` article also highlights session-cookie-based cloud sync as a practical necessity for agent tools without APIs, which makes secret separation even more important ([OpenSite post](https://dev.to/opensite/one-repo-every-ai-agent-zero-drift-introducing-the-opensite-skills-library-2k3g)).

## YouTube Findings

The YouTube portion of this research was based on a larger set of videos reviewed from local captions using `youtube-captions-dl`.

### Claude Code and Cursor videos

The Claude/Cursor videos repeatedly converged on five ideas:

- Keep always-on context small and explicit.
- Move repeatable processes into skills or modular rules.
- Use hooks or permissions for hard guarantees.
- Grow rules incrementally from repeated mistakes.
- Separate core repo context from specialized workflows.

Sources: [Tech With Tim Claude guide](https://www.youtube.com/watch?v=uogzSxOw4LU), [Anthropic skills video](https://www.youtube.com/watch?v=fOxC44g8vig), [Eric Tech skills video](https://www.youtube.com/watch?v=bFC1QGEQ2E8), [Matt Pocock skills video](https://www.youtube.com/watch?v=EJyuu6zlQCg), [Matt Pocock hook video](https://www.youtube.com/watch?v=3CSi8QAoN-s), [hUndefined Cursor rules](https://www.youtube.com/watch?v=IsXrCBlAshg), [Convex Cursor rules](https://www.youtube.com/watch?v=QXOZfIUOnQM), [Bryan Collins Cursor rules](https://www.youtube.com/watch?v=cHkBSjLR4Yk), [Elie Steinbock Cursor rules](https://www.youtube.com/watch?v=sxqq9Eql6Cc).

### Dotfiles and bootstrap videos

The dotfiles/bootstrap videos were even more consistent:

- The Git repo should be the durable source of truth.
- New-machine setup should reduce to clone/init plus apply.
- Symlinks are the simplest deployment primitive.
- `chezmoi` is better than raw symlinks when you need templates, secrets, and per-machine variation.
- Setup docs and install scripts belong in the same repo as the config.

Sources: [Tom Payne chezmoi](https://www.youtube.com/watch?v=JrCMCdvoMAw), [Let's Code chezmoi](https://www.youtube.com/watch?v=L_Y3s0PS_Cg), [sudopluto chezmoi](https://www.youtube.com/watch?v=id5UKYuX4-A), [Josean Martinez Stow](https://www.youtube.com/watch?v=06x3ZhwrrwA), [Typecraft Stow](https://www.youtube.com/watch?v=NoFiYOqnC4o), [Dreams of Autonomy Stow](https://www.youtube.com/watch?v=y6XCebnB9gs), [Fireship dotfiles](https://www.youtube.com/watch?v=r_MpUP6aKiQ), [Bartek Spitza](https://www.youtube.com/watch?v=mSXOYhfDFYo), [GeekMasher](https://www.youtube.com/watch?v=OHR0v0jrDik).

### GitHub Copilot videos

The Copilot videos clearly distinguish repo-wide custom instructions from task-specific prompt files:

- `copilot-instructions.md` should hold broad team guidance.
- prompt files should hold reusable task-specific prompts and referenced docs.
- path-specific instruction files keep repo-wide instructions from becoming overloaded.
- repository docs and specs are prompt assets, not just human prose.

Sources: [VS Code custom instructions](https://www.youtube.com/watch?v=zwIlqbTHjac), [Tim Warner prompt files](https://www.youtube.com/watch?v=nNiDplJqU6w), [Visual Studio custom instructions](https://www.youtube.com/watch?v=BdZWFlFiHHY), [Tim Warner custom instructions](https://www.youtube.com/watch?v=Jt3i1a5tSbM), [VS Code prompt enhancement](https://www.youtube.com/watch?v=cu9zZAFmoDg).

## Anti-Patterns to Avoid

- Manually maintaining separate `CLAUDE.md`, Cursor rules, Copilot instruction files, and Codex skills with no generator layer.
- Treating skills as the only place where core repo knowledge lives.
- Growing a giant always-on instruction file that burns context and weakens adherence.
- Storing secrets in the shared repo.
- Encoding hard requirements only as prompt prose instead of hooks/tests/permissions.
- Centralizing project-specific build/test truth in a personal harness repo rather than in the project repo itself.
- Using per-machine branches as the main override strategy when templates or local overlays would do the job more cleanly.

## Final Recommendation

If I were designing this from scratch for a serious multi-harness developer in 2026, I would do the following:

1. Standardize each project repo on a small root `AGENTS.md`.
2. Keep reusable global skills, commands, agent personas, MCP configs, and hook policies in one dedicated `ai-registry` repo.
3. Generate harness-specific outputs from that repo instead of maintaining native files manually.
4. Use `chezmoi` to install, template, and apply the setup across machines.
5. Keep secrets external and inject them at apply time.
6. Keep hard guardrails executable, not just documented.
7. Treat the system as living infrastructure: review, prune, and refactor the instruction layer the same way you would code.

That is the most robust way to get one canonical source of truth, low drift, fast new-machine setup, and broad harness coverage without painting yourself into a single-vendor corner.

## Sources Reviewed

This research synthesized:

- Official docs from Claude Code, Cursor, GitHub Copilot, OpenAI Codex, OpenCode, Aider, chezmoi, GNU Stow, Missing Semester, Home Manager, AGENTS.md, and the Agent Skills specification.
- Case studies and blogs from OpenAI, Vercel, Harness, Lukas Masuch, Blake Niemyjski, J.D. Hodges, Corey Daley, OpenSite, and the `agent-harness` project.
- A broad caption-reviewed YouTube set covering Claude Code, Cursor rules, Copilot custom instructions and prompt files, GNU Stow, `chezmoi`, and general dotfiles/bootstrap workflows.
