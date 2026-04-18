---
name: research-topic
description: Research a topic thoroughly across official documentation, engineering blogs, practitioner writeups, case studies, changelogs, and relevant videos, then synthesize the findings into a cited report with recommendations and optional 1-10 ratings. Use when asked to research a subject, survey best practices, compare tools or architectures, identify common patterns, or produce a comprehensive research.md-style writeup.
author: alexgorbatchev
---

# Research Topic

Produce a decision-quality research brief, not a search dump. Prefer breadth first, then synthesis.

## Frame The Research

Pin down:

- exact topic
- audience or decision to support
- required deliverable such as `research.md`, memo, comparison table, or recommendation
- constraints such as time horizon, platforms, languages, or tooling
- any explicit scope limits; otherwise assume exhaustive coverage and still end with a recommendation

Turn vague requests into a small set of research questions. Useful defaults:

- What approaches exist?
- Which approach is best, and for whom?
- What tradeoffs, risks, and anti-patterns recur?
- Where do sources disagree?

## Build A Broad Source Mix

Do not rely on a single source type.

Prefer this mix when available:

1. Official docs, specifications, changelogs, or reference material for factual behavior
2. Vendor or maintainer engineering blogs for rationale and intended workflows
3. Practitioner blogs, case studies, and open-source repos for real-world usage
4. Benchmarks, evaluations, or academic papers when performance or evidence quality matters
5. Relevant videos, talks, or podcast summaries for workflow and practitioner habits

If videos are relevant, review more than a token sample. Use captions or transcripts when possible. If only metadata is available, say so and treat it as weaker evidence.

For YouTube videos, use `youtube-captions-dl '<video-url>'` to fetch closed captions as plain text instead of relying on the watch page alone. The tool prefers human-created caption tracks and falls back to the first auto-generated track when needed.

Treat YouTube captions as supporting evidence, not the strongest source for precise technical facts. Cite the video URL in the report, and say explicitly when captions were unavailable or only auto-generated.

## Gather Evidence

For each source, capture:

- title
- URL
- source type
- date or version when relevant
- the concrete claim or takeaway
- whether it is factual, prescriptive, benchmarked, or anecdotal

Look for repeated patterns across independent sources. Distinguish:

- direct facts from docs
- opinions or workflow preferences
- evidence-backed claims
- claims that may be stale or version-specific

## Evaluate Approaches

When the user asks for "best," "recommended," "top," or "compare," define an explicit 1-10 rating system before scoring options.

Use criteria that fit the topic. Common examples:

- correctness or evidence quality
- maintainability
- portability
- setup complexity
- operating cost
- performance
- drift resistance
- security
- user ergonomics

State the criteria and use them consistently. Explain why a high score is high and why a lower score is lower.

## Synthesize, Do Not Just List

Lead with the answer after enough evidence is gathered.

Separate:

- what most sources agree on
- where tradeoffs appear
- where sources conflict
- what is still uncertain

Prefer concrete recommendations over generic summaries. If the best answer is conditional, say for whom each option is best.

## Cite Inline

Add citations inline wherever you make a factual claim, quote a recommendation, or reference an approach. Do not batch all citations at the end and leave the body unsupported.

Good:

- `AGENTS.md` is now treated as a cross-tool instruction format by multiple harnesses ([AGENTS.md](https://agents.md/), [OpenCode rules docs](https://opencode.ai/docs/rules/)).`

Weak:

- `Many tools support AGENTS.md.`

## Shape The Output

When writing a full report, default to `{{repo_root}}/wiki/research/<topic-slug>.md` unless the user explicitly asks for a different path.

Create `{{repo_root}}/wiki/research/` first if it does not already exist.

Generate `<topic-slug>` from the subject of the research using concise hyphen-case.

Example:

- `{{repo_root}}/wiki/research/ai-agent-harness-configuration.md`

Do not literally use `topic.md` as the filename unless the user explicitly insists on that exact basename.

Use this document shape:

1. Title as the first line
2. Creation date on the next line
3. Last update date on the following line
4. A section for the original user prompt as a block quote
5. The rest of the research sections

Use this header pattern:

```markdown
# <Title>

Created: YYYY-MM-DD
Last updated: YYYY-MM-DD

## Original Prompt

> <original user prompt>
```

If the file already exists, preserve the original creation date and update only `Last updated`.

After that header, default to this structure unless the user asks otherwise:

- Executive Summary
- Short Answer or Recommendation
- Rating System
- Compared Approaches or Options
- Common Patterns and Best Practices
- Disagreements or Tensions
- Risks and Anti-patterns
- Final Recommendation
- Sources Reviewed

## Hold The Quality Bar

Keep the writeup:

- source-grounded
- specific
- version-aware when relevant
- explicit about uncertainty
- concise in conclusions and detailed in evidence

Avoid:

- padding with generic background
- unsupported claims
- overfitting to one vendor or one creator
- treating videos as the only evidence source for technical facts
- giving scores without published criteria

## Default To Exhaustive Depth

Treat research requests as exhaustive by default, not surface-level surveys.

Only narrow the depth when:

- the user explicitly asks for a quick, practical, or high-level answer
- time, source availability, or other stated constraints materially limit the evidence you can gather

When you do narrow the depth, say so explicitly and note what deeper follow-up would still be worth checking.
