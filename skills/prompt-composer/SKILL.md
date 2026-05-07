---
name: prompt-composer
description: Compose, rewrite, refactor, and adapt prompts for LLM applications. Use when drafting system, developer, or user prompts; turning vague requirements into reusable prompt templates; improving prompt reliability or output format; or deciding prompt structure for grounded, long-context, tool-using, or structured-output workflows.
author: alexgorbatchev
---

# Prompt Composer

Turn vague prompt requests into explicit prompt contracts that another model can execute reliably. Keep the guidance universal and interface-agnostic. Focus on stable prompt design principles such as structure, grounding, output contracts, and iteration. Treat every prompt as a reusable starting point that still needs validation in its target runtime.

## Workflow

1. Identify the target runtime.
- Determine the interface constraints before drafting: system/developer/user roles, reusable prompt templates, tool calling, structured outputs, long context, or prompt caching.
- If the execution environment is unspecified, write a general-purpose prompt, label it as a starting point, and re-test it in the target runtime before treating it as stable.

2. Define the contract before writing the prompt.
- Capture the task, audience, inputs, constraints, grounding boundary, output format, tone, and completion criteria.
- Define what the model should do when information is missing, conflicting, or out of scope.
- If success cannot be checked, tighten the request before drafting.

3. Choose the smallest prompt shape that can work.
- Start with a minimal structure. Add examples, verification rules, or tool policies when they clarify the target behavior, reduce ambiguity, or improve reliability.
- Separate stable instructions from variable inputs so the prompt can be reused and versioned.
- Pick one delimiter style, usually Markdown headings or XML-style tags, and use it consistently.
- Prefer clear sections, numbered steps, and explicit delimiters over dense prose.

4. Compose the prompt from labeled blocks.
- `role`: who the model is for this task
- `task`: the job to perform
- `context`: source material, background, or retrieved documents
- `constraints`: rules, non-goals, or limits
- `examples`: representative examples that define behavior, format, or edge cases
- `output_contract`: exact return shape
- `grounding_rules`, `tool_rules`, or `fallback_rules`: only when needed

5. Review the draft for failure modes.
- Remove duplicated or contradictory instructions.
- Define vague words like `concise`, `important`, `better`, or `complete`.
- Check that examples match the actual task and output contract.
- Separate prompt text from runtime controls. Do not bake runtime-specific knobs into reusable prompt text unless the target environment requires them.

6. Recommend an evaluation loop.
- Propose representative test cases, edge cases, and failure cases.
- Treat prompt writing as iterative engineering. Revise against observed failures instead of adding random extra instructions.

## Portability

- A reusable prompt is a portable starting point, not a portability guarantee.
- When moving a prompt between runtimes or model versions, preserve the task contract but re-test the prompt on a small eval set.
- Prompt text is only one control surface. Check whether the target environment exposes native controls for reasoning, verbosity, or tool behavior before compensating with extra prompt scaffolding.
- Watch for shifts in instruction-following, verbosity, formatting, grounding, and tool behavior.
- Adjust examples, scaffolding, and output constraints based on observed behavior.

## Runtime And State Management

- Treat long-context reliability as both a prompt problem and a runtime design problem.
- For long-running sessions, watch for context rot, duplicated history, and stale instructions that no longer reflect the active task.
- When the runtime supports compaction or context editing, preserve the active contract, critical constraints, and unresolved work while dropping stale detail.
- When caching matters, keep stable prefixes stable. Avoid rewriting early prompt segments unless the behavioral contract truly changed.
- For append-only chat systems, prefer adding corrected guidance in a new turn over silently mutating prior turns.
- For document-heavy tasks, decide explicitly whether you are optimizing for long-context accuracy, cache locality, or both.

## Prompt Skeleton

Use a simple labeled structure like this. Markdown headings, bullets, or XML-style tags can all work; choose the lightest wrapper that keeps boundaries clear in the target environment.

```md
## Role

[[role]]

## Task

[[task]]

## Context

[[context]]

## Constraints

- [[constraint_1]]
- [[constraint_2]]

## Output Contract

- Return [[required_sections_or_schema]].
- Use [[format]].
- If information is missing or unsupported, [[fallback_behavior]].
```

Keep placeholders explicit, for example `[[variable_name]]`. If the prompt will be reused, isolate variable fields instead of hardcoding them into the instruction text.

## Decision Rules

### Use examples to define target behavior

- Examples are a useful way to specify format, tone, boundary cases, and decision criteria.
- For trivial tasks, direct instructions may be enough.
- For other tasks, representative examples may improve consistency.
- If unsure, compare a direct-instruction version and an example-based version on a small eval set.
- Keep examples relevant, consistent, and aligned with the instructions.

### Ground the model instead of hoping

- Supply the source material needed for the task instead of assuming the model already knows it.
- For factual or document-based tasks, tell the model whether it may use only the supplied context or also its own background knowledge.
- For long-document question answering, consider asking the model to quote or extract the relevant evidence before answering.
- If optimizing for long-context quality, put bulk context before the final question.
- If optimizing for prompt caching, keep static instructions and examples at the beginning of the prompt and append variable content later.
- If a monolithic prompt mixes large context with instructions, separate the two and keep the instructions concise.

### Make the output contract explicit

- Name the exact sections, schema, citations, verbosity, and allowed output formats.
- State what to do when the answer is unavailable, blocked, or ambiguous.
- Prefer native structured-output features over prompt-only JSON when the target API supports them.
- If the task needs only a delta, patch, or classification label, say that directly instead of inviting a full rewrite.

### Add tool and agent rules only when applicable

- If the prompt controls tools, define when tools are required, when to stop, and what must be verified before finalizing.
- Make dependency checks explicit when later actions rely on earlier retrieval or validation steps.
- Allow parallel work only for independent steps or workstreams.
- Add permission checks before irreversible or external actions.

### Use reasoning scaffolds deliberately

- Treat reasoning scaffolds as optional controls, not universal defaults.
- Check whether the target environment already exposes native controls for reasoning or effort before adding more prompt scaffolding.
- For simple tasks, use direct instructions.
- For complex or error-prone tasks, consider decomposition, checkpoints, or explicit verification steps.
- Request visible intermediate reasoning only when the workflow actually needs that artifact.
- Keep or remove a reasoning scaffold based on eval results, not doctrine.

## Prompt Assets And Optimization Loop

- Treat reusable prompts as maintained assets, not disposable text snippets.
- Keep a stable template plus clearly named variables instead of cloning near-duplicate prompts.
- Version prompts when behavior changes in a meaningful way.
- Tie prompt changes to eval cases so you can tell whether a rewrite improved or regressed behavior.
- Use prompt improvers or optimizers as assistants, not as an authority. Review their suggestions for overfitting and unnecessary reasoning scaffolds.

## Rewriting Existing Prompts

When the user gives you an existing prompt to improve:

1. Extract the real contract.
- Separate instructions, context, examples, output rules, and hidden assumptions.
- Preserve the intended behavior unless the user asks for a behavior change.

2. Remove prompt debt.
- Delete repetition, contradictions, and filler language.
- Replace vague adjectives with measurable requirements.
- Turn buried assumptions into explicit rules.

3. Rebuild the prompt in clean blocks.
- Keep context separate from instructions.
- Move reusable rules into the stable prefix.
- Leave variable data in placeholders or clearly marked context sections.

4. Explain the change in terms of behavior.
- Say what failure mode each rewrite addresses: ambiguity, format drift, hallucination, over-verbosity, missing coverage, weak grounding, or interface mismatch.

## Anti-Patterns

- Vague words like `better`, `interesting`, `short`, or `detailed` without concrete meaning
- Contradictory instructions or examples that teach a different behavior than the rules
- One giant prompt that mixes reusable policy, volatile context, and the user turn with no boundaries
- Prompt-only JSON constraints when the API already offers structured outputs
- Cargo-cult reasoning scaffolds copied across unrelated tasks
- Runtime-specific tuning copied into reusable prompts without a concrete need
- Assuming one interface's role hierarchy or caching semantics apply everywhere

## Review Checklist

Before finalizing a prompt, verify:

- A colleague with little context could follow it correctly.
- The task, constraints, and output contract are explicit.
- The grounding boundary is clear.
- Ambiguous terms are defined.
- Examples, if present, are relevant and consistently formatted.
- The prompt has been treated as a starting point and re-tested in its target runtime.
- The prompt uses only interface features that the target runtime actually supports.
- The prompt includes a plan for handling missing information or unsupported requests.
- The prompt has at least a small eval set or test plan.

## Deliverables

When asked to produce a prompt, return:

- the final prompt
- any runtime assumptions that still matter
- a short list of suggested test cases or evals
