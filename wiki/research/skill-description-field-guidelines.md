---
created_on: 2026-04-23 16:49
last_modified: 2026-04-23 16:49
author: openai/gpt-5.4
status: current
source_url:
  - https://developers.openai.com/codex/skills
  - https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use
  - https://developers.openai.com/apps-sdk/guides/optimize-metadata
---

# Research: How to Compose the `description` Field in `SKILL.md`

## Request

Research how the `description` field in `SKILL.md` should be written, starting with top-tier LLM provider guidance, then broader ecosystem guidance, and end with concrete, decision-quality recommendations for this repository.

## Executive Summary

The strongest cross-source conclusion is that a skill description is not a label. It is **routing metadata**: often the first and sometimes the only information the model sees before deciding whether to load the rest of the skill. That means the description must say both **what the skill does** and **when it should be used**, with enough specificity to separate positive triggers from nearby non-matches ([OpenAI Codex skills](https://developers.openai.com/codex/skills), [OpenAI skills blog](https://developers.openai.com/blog/skills-agents-sdk), [Anthropic tool-use docs](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use), [Agent Skills specification](https://agentskills.io/specification)).

The most useful practical pattern for this repo is:

1. Start with a plain-language capability statement.
2. Follow immediately with a **“Use when …”** trigger sentence.
3. Add a boundary or exclusion sentence when the skill is easy to confuse with neighboring skills.
4. Include concrete keywords, file types, tasks, or contexts the model is likely to see in user requests.
5. Keep the description concise enough to respect metadata token costs, but detailed enough to route reliably.

My recommendation is to standardize on **2-3 sentences by default, with a third or fourth sentence only when disambiguation materially improves routing**. That best fits the tension between Anthropic’s “detailed descriptions are the biggest lever” guidance and OpenAI’s explicit warning that metadata also consumes context ([Anthropic tool-use docs](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use), [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)).

## What the Local Repo Already Says

This repository already treats `description` as the primary routing field:

- `skills/skill-creator/SKILL.md` says the description is the **primary triggering mechanism** for a skill and must include both what the skill does and the specific triggers/contexts for when to use it.
- The same file says all “when to use” information must live in the frontmatter description, not in the body, because the body only loads after the skill has already triggered.
- `skills/skill-creator/scripts/quick_validate.ts` currently enforces only a few hard constraints on `description`: it must exist, be a string, not contain `<` or `>`, and remain within the 1024-character maximum.

That local guidance is directionally aligned with the strongest provider guidance. The repo already has the right mental model; what it lacks is a sharper house style for how to compose the field consistently.

## What Top-Tier Providers Say

### Anthropic: detail is the biggest performance lever

Anthropic’s tool-use guidance is the clearest pro-detail source. It says the description should explain what the tool does, when it should and should not be used, what parameters mean, and important caveats. Anthropic also says that providing **extremely detailed descriptions is by far the most important factor in tool performance**, and recommends at least 3-4 sentences for complex tools ([Anthropic tool-use docs](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use)). Anthropic’s engineering post reinforces that small description refinements can materially improve agent performance, especially when they make implicit context explicit and define boundaries clearly ([Anthropic engineering blog](https://www.anthropic.com/engineering/writing-tools-for-agents)).

Implication for `SKILL.md`: vague one-liners are usually under-specified. If a skill is narrow, the description can stay short. If it is broad, multi-modal, or easy to confuse with adjacent skills, the description must carry more routing detail.

### OpenAI: descriptions are routing metadata, but metadata has a token cost

OpenAI’s skill docs say the model sees the skill metadata first and uses the description for implicit invocation, so descriptions need clear scope and boundaries ([OpenAI Codex skills](https://developers.openai.com/codex/skills)). OpenAI’s skills blog is even more explicit: the description is part of the **routing contract**, and if routing is unreliable, the first thing to fix is the metadata rather than the implementation ([OpenAI skills blog](https://developers.openai.com/blog/skills-agents-sdk)).

OpenAI’s Apps SDK guidance gives the most directly reusable composition advice: start descriptions with **“Use this when …”**, state what the tool is for, and call out disallowed cases. It also recommends evaluating metadata against positive and negative prompt sets rather than assuming the first wording is good enough ([OpenAI Apps SDK](https://developers.openai.com/apps-sdk/guides/optimize-metadata)).

At the same time, OpenAI’s function-calling docs warn that descriptions count against the context window and should be shortened where possible, especially in large toolsets ([OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)).

Implication for `SKILL.md`: make the description detailed enough to route correctly, but do not waste tokens on marketing prose, repetition, or body content that belongs elsewhere.

### Microsoft and broader tool ecosystems: semantic descriptions are part of the interface

Microsoft’s Semantic Kernel docs say the descriptions attached to functions and parameters are what the AI uses to understand capabilities, and recommend liberal use of descriptions when behavior is not obvious ([Semantic Kernel](https://learn.microsoft.com/en-us/semantic-kernel/concepts/plugins/adding-native-plugins)). Pydantic AI similarly turns function docstrings and parameter descriptions into model-visible schema, and can even require parameter descriptions programmatically ([Pydantic AI](https://ai.pydantic.dev/tools/)). MCP is less prescriptive, but its tool schema still includes `description` as a first-class human-readable field ([MCP spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)).

Implication for `SKILL.md`: description quality is not a repo-local stylistic preference. Across agent frameworks, semantic descriptions are part of the actual control surface presented to the model.

## What the Sources Strongly Agree On

### 1. The description must include both capability and trigger conditions

This is the strongest point of agreement. OpenAI skills, Anthropic tool-use guidance, the Agent Skills specification, and this repo’s own `skill-creator` guidance all converge on the same rule: the description must communicate both **what the asset does** and **when the model should use it** ([OpenAI Codex skills](https://developers.openai.com/codex/skills), [Anthropic tool-use docs](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use), [Agent Skills specification](https://agentskills.io/specification), `skills/skill-creator/SKILL.md`).

### 2. Clear boundaries beat vague generality

The best descriptions define scope and nearby exclusions. OpenAI explicitly calls for boundaries and disallowed cases ([OpenAI Apps SDK](https://developers.openai.com/apps-sdk/guides/optimize-metadata)); Anthropic says to explain when the tool should and should not be used ([Anthropic tool-use docs](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use)).

### 3. Concrete keywords and contexts improve recall

The Agent Skills specification explicitly recommends specific keywords so agents can match relevant tasks ([Agent Skills specification](https://agentskills.io/specification)). Anthropic’s engineering guidance says to include the niche terminology, data relationships, and formats a new hire would need to recognize the right tool ([Anthropic engineering blog](https://www.anthropic.com/engineering/writing-tools-for-agents)). In practice, that means file types, frameworks, artifact names, and task verbs belong in the description when they help routing.

### 4. Routing metadata should be evaluated, not just written once

OpenAI recommends direct, indirect, and negative evaluation prompts to measure whether metadata improves precision and recall ([OpenAI Apps SDK](https://developers.openai.com/apps-sdk/guides/optimize-metadata)). Anthropic’s engineering post also recommends iterative refinement based on actual failures rather than intuition alone ([Anthropic engineering blog](https://www.anthropic.com/engineering/writing-tools-for-agents)).

## Where the Sources Differ

### Anthropic pushes harder toward verbosity

Anthropic is the strongest source arguing that detailed descriptions are the biggest performance lever, including explicit 3-4 sentence guidance for complex tools ([Anthropic tool-use docs](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use)).

### OpenAI is more explicit about token economy

OpenAI agrees that descriptions need clear routing semantics, but it is more explicit that metadata is not free and should be shortened when possible ([OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)).

### Synthesis

For `SKILL.md`, these are not contradictory. The right rule is:

- **Use as much detail as routing needs.**
- **Do not spend tokens on detail that does not change routing decisions.**

That yields a practical default of 2-3 sentences, with more only when ambiguity is a real problem.

## Concrete Guidelines for This Repository

### Recommended shape

Use this pattern for almost every skill description:

1. **Capability sentence**: what the skill enables.
2. **Trigger sentence**: “Use when …” plus the tasks, artifacts, or contexts that should activate it.
3. **Optional boundary sentence**: when not to use it, or what nearby tasks belong elsewhere.

### Recommended content checklist

Every `description` should answer these questions directly:

- What does this skill do?
- What user requests, task shapes, file types, or domains should trigger it?
- What nearby cases should *not* trigger it?
- Which concrete keywords will likely appear in relevant requests?

### Recommended wording rules

- Use plain, operational language rather than marketing language.
- Prefer explicit trigger verbs such as **build**, **refactor**, **debug**, **review**, **analyze**, **migrate**, **test**, **document**.
- Include concrete artifacts when they matter: `.tsx`, `Dockerfile`, Storybook stories, `AGENTS.md`, Tailwind config, Bun server, etc.
- Prefer “Use when …” wording because it matches both OpenAI’s explicit recommendation and the strongest patterns already present in this repo ([OpenAI Apps SDK](https://developers.openai.com/apps-sdk/guides/optimize-metadata)).
- Keep all trigger logic in the description, not in a later “When to use” section of the body (`skills/skill-creator/SKILL.md`).

### Recommended length rule

- Default to **2-3 sentences**.
- Use **4 sentences** only when the skill is broad, easy to confuse with adjacent skills, or requires unusually specific routing cues.
- Stay comfortably below the 1024-character validator ceiling unless there is a compelling reason not to (`skills/skill-creator/scripts/quick_validate.ts`).

### Anti-patterns to avoid

- **Too vague**: “Helps with React.”
- **Capability only, no trigger**: “Provides TypeScript guidance.”
- **Trigger only, no capability**: “Use when editing frontend files.”
- **Marketing copy**: “Powerful all-in-one solution for modern development.”
- **Body-only routing**: keeping the real trigger logic under a later heading that the model will not see until after the routing decision.
- **Keyword starvation**: omitting the concrete terms users will actually mention.

## Recommended House Style

Use this template unless there is a strong reason not to:

> `<Capability sentence>. Use when <specific tasks, artifacts, domains, or trigger contexts>. <Optional: Do not use when / Not for ...>.`

### Example pattern

Bad:

> Helps with React.

Better:

> Build and modify React components, hooks, context providers, and JSX render trees. Use when implementing or refactoring React UI code, component APIs, render branches, shared primitives, or hook-driven state. Do not use for backend-only TypeScript changes or framework-agnostic utilities.

Why the better version works:

- It states the capability.
- It names concrete triggers.
- It defines nearby exclusions.
- It includes keywords likely to appear in user requests.

## Recommended Review Rubric

Before accepting a skill description, check whether it passes these tests:

1. **Capability test**: Could a reader tell what the skill actually does?
2. **Trigger test**: Could a model infer when to use it from the description alone?
3. **Boundary test**: Would the description help distinguish this skill from neighboring skills?
4. **Keyword test**: Does it contain the concrete terms likely to appear in real requests?
5. **Token test**: Is every sentence earning its place, or is there fluff?

If the answer to any of the first four is “no,” the description is under-specified. If the answer to the fifth is “no,” it is bloated.

## Recommendation

For this repository, the best default standard is:

- **Require descriptions to contain both capability and trigger information.**
- **Prefer a 2-3 sentence structure with an explicit “Use when …” clause.**
- **Add an exclusion sentence only when it improves routing precision.**
- **Encourage concrete keywords, file types, and task contexts.**
- **Reject vague one-liners and body-only trigger guidance.**
- **Treat description iteration as an eval problem, not a purely stylistic one.**

That recommendation is the best fit for both the repo’s own progressive-disclosure model and the strongest external evidence: descriptions are routing metadata, and routing quality improves when the description clearly states scope, triggers, boundaries, and keywords without wasting tokens ([OpenAI Codex skills](https://developers.openai.com/codex/skills), [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/guides/optimize-metadata), [Anthropic tool-use docs](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use), [Anthropic engineering blog](https://www.anthropic.com/engineering/writing-tools-for-agents), [Agent Skills specification](https://agentskills.io/specification)).

## Sources

### Primary provider sources

- OpenAI Codex skills: https://developers.openai.com/codex/skills
- OpenAI skills blog: https://developers.openai.com/blog/skills-agents-sdk
- OpenAI Apps SDK metadata guide: https://developers.openai.com/apps-sdk/guides/optimize-metadata
- OpenAI function calling guide: https://developers.openai.com/api/docs/guides/function-calling
- Anthropic tool-use implementation guide: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use
- Anthropic engineering post on writing tools: https://www.anthropic.com/engineering/writing-tools-for-agents
- Microsoft Semantic Kernel plugin guidance: https://learn.microsoft.com/en-us/semantic-kernel/concepts/plugins/adding-native-plugins

### Ecosystem and standards sources

- Agent Skills specification: https://agentskills.io/specification
- Model Context Protocol tools spec: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- Pydantic AI tools: https://ai.pydantic.dev/tools/

### Local repository sources

- `skills/skill-creator/SKILL.md`
- `skills/skill-creator/scripts/quick_validate.ts`
