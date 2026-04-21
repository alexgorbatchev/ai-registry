# Research Brief: OpenCode Session-History Learning Tooling

## Decision Frame

- Exact topic: whether there is an OpenCode plugin or tool that can analyze past session history and turn it into reusable learnings for better future sessions.
- Audience: an OpenCode user or maintainer deciding whether to adopt an existing solution, combine tools, or build one.
- Deliverable: recommendation memo with comparison table and explicit scoring.
- Constraints: current OpenCode docs and ecosystem as of Apr 2026; focus on OpenCode-native or directly integrated options; exhaustive within that scope.
- Scope limit: I included adjacent OpenCode integrations that improve future sessions through memory or continuity, but I did not broaden into generic agent-memory products unless they have a documented OpenCode integration.

## Executive Summary

Yes, but the best answer splits into two categories.

The best existing match for **retrospective analysis of OpenCode session history** is the repo-local `opencode-conversation-analysis` skill, which explicitly extracts user messages from OpenCode's SQLite or legacy JSON storage, chunks them, and synthesizes recurring steering themes from prior sessions (`.agents/skills/opencode-conversation-analysis/SKILL.md`, `.agents/skills/opencode-conversation-analysis/references/storage-format.md`, `.agents/skills/opencode-conversation-analysis/scripts/extract.sh`).

The best existing match for **automatic future-session improvement** is not a history-analysis plugin but a **memory plugin**, especially `opencode-supermemory`, which injects remembered user preferences, project knowledge, and prior learned patterns into future sessions and compaction flows ([OpenCode ecosystem](https://opencode.ai/docs/ecosystem/), [OpenCode integration docs](https://supermemory.ai/docs/integrations/opencode), [repo README](https://github.com/supermemoryai/opencode-supermemory)).

If you want one recommendation:

- Use `opencode-conversation-analysis` if your goal is **periodic retrospective learning**.
- Use `opencode-supermemory` if your goal is **automatic continuity across sessions**.
- Build a plugin or SDK service over OpenCode's session/message APIs only if you want **continuous, opinionated, organization-specific learning loops**; OpenCode exposes the primitives, but I did not find a first-party built-in feature dedicated to that use case ([Server](https://opencode.ai/docs/server/), [SDK](https://opencode.ai/docs/sdk), [Plugins](https://opencode.ai/docs/plugins), [Config](https://opencode.ai/docs/config/)).

## Short Answer

The strongest current option is a **hybrid**:

1. Use the local `opencode-conversation-analysis` skill to mine patterns from past sessions.
2. Convert the validated patterns into durable instructions, memories, or commands.
3. If you want those learnings injected automatically later, pair that with `opencode-supermemory` or a small custom plugin/tool.

That is better than expecting a single off-the-shelf OpenCode plugin to do perfect transcript mining, summarization, curation, and future-session injection end to end, because OpenCode's official platform exposes extensibility primitives, not a first-party "learn from my history" product feature ([Skills](https://opencode.ai/docs/skills/), [Commands](https://opencode.ai/docs/commands/), [Plugins](https://opencode.ai/docs/plugins/), [Custom Tools](https://opencode.ai/docs/custom-tools/), [Server](https://opencode.ai/docs/server/)).

## Rating System

Scores are 1-10 on this scale:

- 9-10: best default recommendation for the stated need
- 7-8: strong option with meaningful tradeoffs
- 5-6: workable but not ideal
- 1-4: poor fit

Criteria:

- Fit to the exact ask: does it truly analyze history and derive learnings?
- Automation: does it improve future sessions without manual work?
- Privacy/control: does the data stay local and remain inspectable?
- Evidence quality: official docs plus concrete implementation evidence
- Effort: how much setup or custom engineering is required

## Compared Options

| Option | Type | Best For | Score | Why |
|---|---|---:|---:|---|
| `opencode-conversation-analysis` | Repo-local skill | Retrospective analysis of how you steer agents | 9/10 | It is the only source I found that explicitly extracts OpenCode session history and analyzes recurring themes from it (`.agents/skills/opencode-conversation-analysis/SKILL.md`, `.agents/skills/opencode-conversation-analysis/references/storage-format.md`) |
| `opencode-supermemory` | Community plugin | Automatic carry-forward of learned preferences and project knowledge | 8/10 | Strong for future-session improvement, but it is memory injection, not transcript analytics; also external SaaS and Pro-plan dependent ([integration docs](https://supermemory.ai/docs/integrations/opencode), [repo README](https://github.com/supermemoryai/opencode-supermemory)) |
| Custom plugin or SDK app over OpenCode session APIs | Build-it-yourself | Teams wanting continuous, tailored learning loops | 8/10 | OpenCode exposes session/message APIs, SSE events, plugin hooks, and custom tools, so the primitives exist ([Server](https://opencode.ai/docs/server/), [SDK](https://opencode.ai/docs/sdk), [Plugins](https://opencode.ai/docs/plugins)) |
| `micode` continuity ledger approach | Community plugin/workflow | Structured continuity and searchable past artifacts | 7/10 | Good for continuity, but it stores ledgers/plans/artifacts rather than mining raw session history directly ([repo README](https://github.com/vtemian/micode)) |
| `@plannotator/opencode` | Community plugin | Capturing high-quality human feedback during planning | 6/10 | Helpful for improving later implementation quality, but it is interactive plan review, not session-history analysis ([repo README](https://github.com/backnotprop/plannotator/tree/main/apps/opencode-plugin)) |
| Commands-only approach | Built-in wrapper | Lightweight manual workflow | 5/10 | Commands are prompt wrappers with shell/file injection, not durable analytics or event-driven learning ([Commands](https://opencode.ai/docs/commands)) |

## What Exists Today

### 1. Direct history analysis exists, but as a skill, not a first-party product feature

The local `opencode-conversation-analysis` skill is the closest direct answer to your question. It says it analyzes user messages from OpenCode sessions to identify "recurring themes, communication patterns, and steering behaviours," and its extraction workflow reads from `~/.local/share/opencode/opencode.db` when present, falling back to legacy JSON storage (`.agents/skills/opencode-conversation-analysis/SKILL.md`, `.agents/skills/opencode-conversation-analysis/references/storage-format.md`).

Its storage reference documents the current SQLite layout with `session`, `message`, and `part` tables, filtering main sessions via `parent_id IS NULL` and user messages via `json_extract(message.data, '$.role') = 'user'` (`.agents/skills/opencode-conversation-analysis/references/storage-format.md`). Its extraction script then chunks the output for parallel thematic analysis instead of trying to stuff all transcripts into one prompt, which is consistent with broader agent-context advice to control and curate context rather than dumping everything in blindly (`.agents/skills/opencode-conversation-analysis/scripts/extract.sh`, [12-Factor Agents](https://github.com/humanlayer/12-factor-agents)).

This is the strongest evidence-backed answer because it is not hypothetical. It is a concrete tool already designed for exactly this workflow.

### 2. OpenCode officially supports the building blocks, not a built-in "learn from history" module

OpenCode officially supports:

- Skills loaded on demand from `.opencode/skills`, `.agents/skills`, `.claude/skills`, and global equivalents ([Skills](https://opencode.ai/docs/skills/)).
- Custom commands that wrap prompts, shell output, and file references ([Commands](https://opencode.ai/docs/commands/)).
- Plugins that can subscribe to events like `session.created`, `session.compacted`, `message.updated`, `session.idle`, and `tool.execute.*`, and can add custom tools ([Plugins](https://opencode.ai/docs/plugins/)).
- A server and SDK exposing session listing, session messages, session summarize, events, and more ([Server](https://opencode.ai/docs/server/), [SDK](https://opencode.ai/docs/sdk)).
- Config support for plugins, including npm packages and local plugin directories ([Config](https://opencode.ai/docs/config/)).

That means OpenCode clearly supports **implementing** a learn-from-history system, but I did not find a first-party official feature marketed as "analyze session history and derive learnings for future sessions."

### 3. Community plugins focus more on memory, telemetry, continuity, and workflow than transcript mining

The OpenCode ecosystem page lists plugins for telemetry, notifications, pruning, memory, worktrees, and browser/search integrations, including `opencode-helicone-session`, `opencode-wakatime`, `opencode-supermemory`, and others ([Ecosystem](https://opencode.ai/docs/ecosystem/)).

That pattern matters. The community is using plugins mainly for:

- observability and grouping (`opencode-helicone-session`) ([npm page](https://www.npmjs.com/package/opencode-helicone-session))
- activity tracking (`opencode-wakatime`) ([npm page](https://www.npmjs.com/package/opencode-wakatime))
- continuity and memory (`opencode-supermemory`, `micode`) ([integration docs](https://supermemory.ai/docs/integrations/opencode), [repo README](https://github.com/vtemian/micode))
- interactive plan review (`@plannotator/opencode`) ([repo README](https://github.com/backnotprop/plannotator/tree/main/apps/opencode-plugin))

That is evidence that the ecosystem already treats "future-session improvement" mostly as **memory/continuity injection** or **workflow instrumentation**, not as a single monolithic transcript-analysis product.

## Best Option By Need

### If you mean "analyze old sessions and tell me what I should change"

Choose `opencode-conversation-analysis`.

Why:

- It is purpose-built for retrospective analysis of prior sessions.
- It mines actual stored OpenCode data.
- It focuses on recurring themes in user steering, feedback, and preferences.
- It stays local and inspectable.

This is the cleanest fit to the exact wording of your request (`.agents/skills/opencode-conversation-analysis/SKILL.md`).

### If you mean "make future sessions smarter automatically"

Choose `opencode-supermemory`.

Why:

- It injects user profile, project memories, and relevant prior memories into future sessions.
- It stores typed memories such as `preference`, `architecture`, `error-solution`, and `learned-pattern`.
- It also hooks compaction to preserve useful context across long-running work ([integration docs](https://supermemory.ai/docs/integrations/opencode), [repo README](https://github.com/supermemoryai/opencode-supermemory)).

But this is not the same as rigorous transcript analysis. It is memory persistence and retrieval.

### If you mean "I want a durable internal system that keeps learning continuously"

Build a custom plugin or SDK service.

Why:

- Plugins can watch session/message/tool events and add custom tools ([Plugins](https://opencode.ai/docs/plugins/)).
- The server exposes session and message APIs, plus SSE streams ([Server](https://opencode.ai/docs/server/)).
- The SDK gives a typed client for those APIs ([SDK](https://opencode.ai/docs/sdk)).

This is the most flexible option, and probably the right one for a team, but not the lowest-effort option for an individual user.

## Common Patterns Across Sources

Most sources agree on these patterns:

- Keep the learning artifact **structured**, not just raw transcript text. OpenCode skills, plugin tools, Supermemory memory types, and micode ledgers all push toward typed or explicitly scoped artifacts rather than opaque blobs ([Skills](https://opencode.ai/docs/skills/), [Plugins](https://opencode.ai/docs/plugins/), [integration docs](https://supermemory.ai/docs/integrations/opencode), [repo README](https://github.com/vtemian/micode)).
- Improve future sessions through **small injected context**, not full-history replay. The local analysis skill chunks transcripts; Supermemory injects only a limited number of memories; broader agent guidance emphasizes owning and curating the context window rather than blindly appending everything (`.agents/skills/opencode-conversation-analysis/scripts/extract.sh`, [integration docs](https://supermemory.ai/docs/integrations/opencode), [12-Factor Agents](https://github.com/humanlayer/12-factor-agents)).
- Event hooks and APIs are the right place for automation. Plugins and the server/SDK are better foundations than slash commands if you want durable, automatic learning loops ([Plugins](https://opencode.ai/docs/plugins/), [Server](https://opencode.ai/docs/server/), [SDK](https://opencode.ai/docs/sdk)).
- Human feedback remains high leverage. Plannotator's whole premise is that structured human review of plans improves later execution, and that showed up in the demo captions as well ([repo README](https://github.com/backnotprop/plannotator/tree/main/apps/opencode-plugin), [demo video](https://youtu.be/_N7uo0EFI-U)).

## Disagreements And Tensions

### Memory vs analysis

`opencode-supermemory` and similar continuity tools treat future improvement as a retrieval problem: save memories, then inject the relevant ones later ([integration docs](https://supermemory.ai/docs/integrations/opencode)). The local conversation-analysis skill treats it as an analysis problem: inspect history, derive themes, then surface learnings (`.agents/skills/opencode-conversation-analysis/SKILL.md`).

Those are not the same. Memory helps recall facts. Analysis helps identify behavioral patterns.

### Automation vs control

Plugins are better for automatic learning loops, but they are also easier to make noisy or privacy-invasive, especially if they auto-store too much or over-inject old context ([Plugins](https://opencode.ai/docs/plugins/), [integration docs](https://supermemory.ai/docs/integrations/opencode)). Offline history analysis is slower and more manual, but easier to audit and correct.

### External service vs local-first

The local skill is local-first. `opencode-supermemory` is explicitly a hosted integration requiring an API key and Pro plan ([integration docs](https://supermemory.ai/docs/integrations/opencode)). That is a real tradeoff if the "learnings" include sensitive prompts, design decisions, or workflow habits.

## Risks And Anti-Patterns

- Treating memory as truth. A stored "learning" can become stale; Supermemory and similar systems improve recall, but they do not guarantee the memory is still correct later ([integration docs](https://supermemory.ai/docs/integrations/opencode)).
- Dumping raw history into prompts. The strongest sources lean the other way: chunk, summarize, scope, and curate context (`.agents/skills/opencode-conversation-analysis/scripts/extract.sh`, [12-Factor Agents](https://github.com/humanlayer/12-factor-agents), [micode](https://github.com/vtemian/micode)).
- Expecting commands alone to solve this. Commands are useful wrappers, but they are not persistent storage, event processing, or history analytics ([Commands](https://opencode.ai/docs/commands)).
- Confusing workflow review with learning storage. Plannotator improves plan quality through annotation, but that does not automatically become reusable future-session guidance unless you add a persistence layer ([repo README](https://github.com/backnotprop/plannotator/tree/main/apps/opencode-plugin)).
- Over-engineering too early. The 12-factor material argues for owning context, prompts, and control flow, but also warns against treating everything as a giant agent loop or over-abstracting prematurely ([12-Factor Agents](https://github.com/humanlayer/12-factor-agents), [talk captions](https://www.youtube.com/watch?v=8kMaTybvDUw)).

## Final Recommendation

Recommended default:

1. Adopt `opencode-conversation-analysis` as the **analysis layer** for retrospective learnings.
2. Turn the recurring validated learnings into one of:
   - a project or global skill
   - a rules/instructions file
   - a small memory store
3. If you want automatic future-session carry-forward, add `opencode-supermemory` or a minimal custom plugin/tool as the **injection layer**.

Why this is the best decision:

- It matches the exact ask better than any community plugin I found.
- It stays local and auditable.
- It avoids conflating "session analytics" with "memory retrieval."
- It uses OpenCode's native extension model instead of fighting it ([Skills](https://opencode.ai/docs/skills/), [Plugins](https://opencode.ai/docs/plugins/), [Server](https://opencode.ai/docs/server/)).

Best-for-whom summary:

- Solo user, local-first, wants to understand patterns: `opencode-conversation-analysis`
- Solo user, wants automatic continuity: `opencode-supermemory`
- Team, wants bespoke automated learnings and policy injection: custom plugin or SDK service
- Team, wants better plan feedback but not full learning automation: `@plannotator/opencode`

## Sources Reviewed

- Official OpenCode docs:
  - [Config](https://opencode.ai/docs/config/)
  - [Agents](https://opencode.ai/docs/agents/)
  - [Commands](https://opencode.ai/docs/commands/)
  - [Skills](https://opencode.ai/docs/skills/)
  - [Plugins](https://opencode.ai/docs/plugins/)
  - [Custom Tools](https://opencode.ai/docs/custom-tools/)
  - [Server](https://opencode.ai/docs/server/)
  - [SDK](https://opencode.ai/docs/sdk/)
  - [CLI](https://opencode.ai/docs/cli/)
  - [Ecosystem](https://opencode.ai/docs/ecosystem/)
- Repo-local implementation evidence:
  - `.agents/skills/opencode-conversation-analysis/SKILL.md`
  - `.agents/skills/opencode-conversation-analysis/references/storage-format.md`
  - `.agents/skills/opencode-conversation-analysis/scripts/extract.sh`
- Community plugin and workflow sources:
  - [opencode-supermemory repo](https://github.com/supermemoryai/opencode-supermemory)
  - [OpenCode integration docs for Supermemory](https://supermemory.ai/docs/integrations/opencode)
  - [opencode-helicone-session npm page](https://www.npmjs.com/package/opencode-helicone-session)
  - [opencode-wakatime npm page](https://www.npmjs.com/package/opencode-wakatime)
  - [micode repo](https://github.com/vtemian/micode)
  - [Plannotator OpenCode plugin README](https://github.com/backnotprop/plannotator/tree/main/apps/opencode-plugin)
- Broader practitioner guidance:
  - [12-Factor Agents repo](https://github.com/humanlayer/12-factor-agents)
- Supporting video evidence via captions:
  - [12-Factor Agents talk](https://www.youtube.com/watch?v=8kMaTybvDUw)
  - [Plannotator demo](https://youtu.be/_N7uo0EFI-U)

---
> # DUE DILIGENCE
> The strongest direct-fit tool I found is repo-local, but its implementation currently conflicts with the harness conventions you're using: it writes analysis chunks to `/tmp/opencode-analysis` instead of a project-local `.tmp/` path, and its shell script uses non-trivial `python3 - <<'PY'` heredocs. That is not a blocker for the research conclusion, but it is a real maintainability/policy mismatch in the current implementation (`.agents/skills/opencode-conversation-analysis/scripts/extract.sh`).
---
