# LLM Wiki

## Verdict

The best skeleton implementation of Karpathy's pattern right now is `atomicmemory/llm-wiki-compiler`.

That is the one I would copy first if the goal is to build a real implementation, not just collect ideas.

Why this is the best pick:

- It stays close to the actual Karpathy loop: `ingest -> compile -> query -> save -> lint`.
- It is still small and understandable enough to fork.
- It solves the biggest engineering problems people kept pointing out in Reddit and HN discussions: order dependence, drift, provenance, and silent bloat.
- It does not immediately explode into a graph platform, an Obsidian product, or a full research operating system.

The most important implementation choice it gets right is the **two-phase compile pipeline**:

1. Extract concepts from all changed sources.
2. Generate pages after the concept set is known.

That is a much better skeleton than naive "read one source and immediately rewrite pages" loops, because it avoids order-dependent wiki shape and reduces accidental duplication.

If you only want a prompt or skill and not a codebase, the best prompt-first skeleton is `Astro-Han/karpathy-llm-wiki`. But for an actual implementation, `atomicmemory/llm-wiki-compiler` is the better base.

## What I Checked

I did not use stars alone. I checked:

- Karpathy's original gist
- Reddit discussion about the pattern
- Hacker News discussion about the gist
- Concrete repos people were actually recommending or building from

The main repos I compared:

- `atomicmemory/llm-wiki-compiler`
- `Astro-Han/karpathy-llm-wiki`
- `AgriciDaniel/claude-obsidian`
- `swarmclawai/swarmvault`
- `skyllwt/OmegaWiki`
- `payneio/prism`
- `ilya-epifanov/llmwiki-tooling`
- `ilya-epifanov/wikidesk`

## Why This One Wins

`atomicmemory/llm-wiki-compiler` is the best skeleton because it has the right level of ambition.

What it includes that matters:

- **Two-phase compilation**: avoids page generation depending on ingest order.
- **Incremental rebuilds via hashes**: only changed sources go back through the LLM.
- **Paragraph-level provenance**: content stays tied to sources instead of becoming pure second-order slop.
- **`query --save`**: good answers become durable wiki pages, which is core to the pattern.
- **Linting**: the wiki is treated like a maintained artifact, not a dump of summaries.
- **Obsidian-compatible markdown output**: portable, inspectable, easy to diff.

What it avoids:

- No giant graph stack in v1.
- No heavy platform lock-in.
- No assumption that the wiki should become a full agent operating system.

That is exactly what a skeleton should do.

## Why Not The More Popular Or Bigger Ones

### `Astro-Han/karpathy-llm-wiki`

Very good as a prompt or skill skeleton. Not the best code skeleton. It tells the agent what to do well, but it is lighter on deterministic implementation machinery.

### `AgriciDaniel/claude-obsidian`

Strong if you already live inside Obsidian and Claude Code. Not a good neutral skeleton. It is already a productized workflow with hooks, plugins, hot cache, visual layers, and more platform assumptions than you want in v1.

### `swarmclawai/swarmvault`

Probably the strongest full product in this space. Also already past the skeleton stage. It has knowledge graph export, approvals, hybrid search, many integrations, and a lot of surface area. Good destination. Wrong starting point.

### `skyllwt/OmegaWiki`

Impressive, but it is a research workflow system, not a general LLM-wiki skeleton. It assumes paper ingestion, experiments, claims, and publication workflows.

### `payneio/prism`

Interesting direction, but even its own framing points toward graph/CMS territory. Good ideas there. Not the cleanest first implementation of Karpathy's markdown-first pattern.

### `ilya-epifanov/llmwiki-tooling` and `wikidesk`

These are useful add-ons after you already have a wiki. They are not the base pattern.

## What The Public Feedback Changed

The forum feedback was useful because the same complaints kept repeating.

### 1. Drift and contradiction are the real failure modes

This came up repeatedly on Reddit and HN. People are not mainly worried about whether the agent can write markdown. They are worried about the wiki quietly becoming wrong, stale, or self-referential.

That means the skeleton must have:

- immutable raw sources
- provenance on generated text
- explicit conflict marking
- a lint pass

### 2. Full autonomy is a trap

A lot of people pushed back on letting the LLM do all the knowledge work. The pattern is strongest when the human curates sources and reviews compiled output, while the model handles bookkeeping.

That means the skeleton should assume **human curation, machine maintenance**.

### 3. Overbuilding happens fast

Several comments described the same thing: once the wiki gets too magical, it becomes another kind of tech debt.

That means the best skeleton should not start with:

- a graph database
- a multi-agent control plane
- a huge plugin surface
- a full team workflow engine

### 4. Flat markdown eventually needs some structure

HN commenters were right that pure prose stops being enough once you need to query richer state.

That means the skeleton should include lightweight structure:

- frontmatter
- `index.md`
- `log.md`
- deterministic link and orphan checks

But that still does **not** mean you should jump straight to a database in v1.

## Best Skeleton To Build

This is the shape I would actually recommend.

```text
my-wiki/
├── raw/
│   └── <topic>/
├── wiki/
│   ├── concepts/
│   ├── entities/
│   ├── queries/
│   ├── index.md
│   └── log.md
├── state/
│   ├── source-hashes.json
│   └── compile-state.json
├── AGENTS.md
└── tools/
    ├── ingest
    ├── compile
    ├── query
    └── lint
```

### Required operations

```text
ingest <url|file>
compile
query "question" [--save]
lint
```

### Minimal page format

```yaml
---
title: Knowledge Compilation
summary: Convert unstructured sources into durable, queryable wiki pages.
sources:
  - raw/ml/2026-04-06-knowledge-compilation.md
updatedAt: 2026-04-14T00:00:00Z
status: draft
confidence: medium
---
```

```markdown
Knowledge compilation turns repeated query-time synthesis into a maintained artifact.^[raw/ml/2026-04-06-knowledge-compilation.md]

Related concepts: [[Concept Extraction]], [[Incremental Compilation]]

## Conflicts

- No material conflicts recorded yet.
```

### Minimal log format

```markdown
## [2026-04-14] ingest | Knowledge Compilation article
- Added raw/ml/2026-04-06-knowledge-compilation.md
- Updated wiki/concepts/Knowledge Compilation.md
- Updated wiki/index.md
```

## Non-Negotiable Design Rules

If you want the skeleton to survive real use, keep these rules.

1. Never mutate `raw/`.
2. Every generated claim should have provenance or be explicitly marked as inferred.
3. Conflicts should be recorded, not silently merged away.
4. `index.md` and `log.md` are first-class files, not optional nice-to-haves.
5. `query --save` should exist, but saved answers should be clearly marked as synthesized pages.
6. Lint must include deterministic checks before any LLM-powered checks.
7. Assume the system will make mistakes. Design for bounded error, not perfect recall.

That last point is important. If you know there will be some error in the system, then the right response is not "trust the model more". The right response is:

- keep the raw source of truth
- keep provenance close to every claim
- keep the review loop cheap
- keep the implementation small enough that you can still understand it

## What I Would Copy From Other Projects

Even though `atomicmemory/llm-wiki-compiler` is the best base, I would steal a few ideas from elsewhere.

### From `Astro-Han/karpathy-llm-wiki`

- Clean agent-facing workflow description
- Strong emphasis on `index.md` and `log.md`
- Good human-in-the-loop framing

### From `ilya-epifanov/llmwiki-tooling`

- Deterministic link fixing
- Orphan detection
- Page rename support

### From `swarmvault`

- Approval mindset
- Contradiction handling as an explicit feature

What I would **not** copy at the start:

- graph database behavior
- massive input-format coverage
- full MCP/product platform surface
- research-pipeline orchestration

## Final Recommendation

If you want one specific answer:

**Use `atomicmemory/llm-wiki-compiler` as the implementation skeleton.**

Then tighten it with three additions:

1. Keep human review mandatory for merge-heavy or conflict-heavy updates.
2. Add deterministic wiki maintenance commands like `llmwiki-tooling` later.
3. Do not adopt graph or platform complexity until the markdown compiler itself hurts.

That is the best balance of correctness, simplicity, and real-world survivability I found.

## References

- Karpathy gist: `https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f`
- Reddit discussion: `https://old.reddit.com/r/learnmachinelearning/comments/1shfkx5/karpathys_llm_wiki_and_why_it_feels_kind_of_a/`
- Hacker News discussion: `https://news.ycombinator.com/item?id=47640875`
- `atomicmemory/llm-wiki-compiler`: `https://github.com/atomicmemory/llm-wiki-compiler`
- `Astro-Han/karpathy-llm-wiki`: `https://github.com/Astro-Han/karpathy-llm-wiki`
- `swarmclawai/swarmvault`: `https://github.com/swarmclawai/swarmvault`
- `AgriciDaniel/claude-obsidian`: `https://github.com/AgriciDaniel/claude-obsidian`
- `skyllwt/OmegaWiki`: `https://github.com/skyllwt/OmegaWiki`
- `payneio/prism`: `https://github.com/payneio/prism`
- `ilya-epifanov/llmwiki-tooling`: `https://github.com/ilya-epifanov/llmwiki-tooling`
- `ilya-epifanov/wikidesk`: `https://github.com/ilya-epifanov/wikidesk`
