---
description: Generate a combined causal report explaining why the agent made a decision or produced an outcome.
---
When the user asks why something happened, why you made a certain decision, what drove you toward an outcome, or why you treated some paths as in scope or out of scope, generate a full causal report.

The report must be environment-agnostic. Focus on the agent's reasoning, instruction interpretation, and selection heuristics rather than the surrounding stack. The repository, language, framework, or runtime may be anything.

Use plain English. Quote the exact instruction phrases that mattered. Do not apologize, do not defend the outcome, and do not talk about formal priority rules. I want the behavioral mechanism: which words changed what you treated as relevant, what they caused you to exclude, and how that produced the outcome. Be concrete and assume I want to prevent this in the future.

Your job is to combine three analyses into one response by default:

1. Mechanism analysis
- Explain how the active instructions interacted at the instinct / heuristic level.
- Tell me which words or phrases became the sharp finish line, which ones became background guidance, and how that changed what you treated as relevant.

2. Source grouping analysis
- Group every quoted instruction by its origin or source.
- Examples of sources: system prompt, developer prompt, harness guidance, loaded skill, repository AGENTS/README, user message.
- Do not mix quoted instructions from different sources together.

3. Inclusion/exclusion analysis
- For each quoted phrase, explain:
  - what it made you include
  - what it made you exclude
  - what concrete output shape, decision, or failure it produced

Use this exact report structure unless the user asks for a different format:

## Combined Analysis

Briefly name the dominant failure mode or decision pattern in one paragraph.

For each source group:

### <Source Name>
Quote each exact instruction phrase that mattered.

For each phrase, include:
- Mechanism: how those words changed what you treated as relevant, urgent, optional, or out of scope
- What it made me include
- What it made me exclude
- Resulting behavior or output shape

## Net Effect

Explain how the phrases worked together. Tell me what they collectively pushed you toward, what they collectively hid or deprioritized, and why that produced the final outcome.

## Prevention

Tell me what acceptance criteria, trigger phrase, or explicit prohibition would have prevented the failure. Phrase this as practical wording I could reuse in the future.

Behavioral rules:

- I want the behavioral mechanism, not the formal rule ordering.
- Tell me which instruction phrase changed what you treated as relevant.
- Explain the interference at the instinct / heuristic level.
- Tell me how those words changed what you included or excluded.
- Quote exact phrases instead of paraphrasing when possible.
- If a source influenced you but there is no short quote that captures it faithfully, say that explicitly.
- If the user asks about a specific decision, tie every explanation back to that exact decision.
- If the outcome happened twice or repeatedly, explain why the same heuristic fired again.
- If the evidence shows that you knew the better path but still chose the narrower one, say so directly.
- Do not hide behind generic statements like "multiple factors"; name the exact phrases and effects.
- Do not speculate about sources you cannot see. Base the report on the active conversation, loaded skills, visible repository guidance, and explicit user instructions.

If the evidence is incomplete, still produce the report, but clearly separate:
- what is directly evidenced by quoted instructions
- what is your best-supported inference about the mechanism
