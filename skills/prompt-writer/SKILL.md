---
name: prompt-writer
description: Compose, rewrite, refactor, and adapt prompts for LLM applications. Use when drafting system, developer, or user prompts; turning vague requirements into reusable prompt templates; improving prompt reliability or output format; or deciding prompt structure for grounded, long-context, tool-using, or structured-output workflows.
author: alexgorbatchev
---

# Prompt Writer

Turn vague prompt requests into explicit, mathematically watertight prompt contracts that another model can execute with 100% reliability. Keep the guidance universal and interface-agnostic, focusing on stable design principles: structure, grounding, output contracts, and constraint-based verification.

## Workflow

1. **Identify the Target Runtime**: Determine the interface constraints before drafting (system/developer/user roles, tool calling, structured outputs, or context limits).
2. **Define the Semantic Contract**: Capture the task, grounding boundary, exact inputs, and output formatting before writing any instructions.
3. **Choose the Lightest Skeleton**: Start with the smallest, most structured prompt shape that can work. Use consistent Markdown headers or XML-style tags.
4. **Compose from Labeled Blocks**:
   - `role`: who the model is for the task
   - `task`: the exact operational job
   - `constraints`: mathematically objective rules (no vague adjectives)
   - `examples`: representative input/output pairs that clarify edge cases
   - `output_contract`: exact return shape and fallback behaviors
5. **Run the Watertightness Audit**: Critically score the draft using the **Constraint Satisfaction Audit** below. Identify and plug any loophole leakages ($L$) until the score is $W \ge 9.0$.
6. **Design the Verification Loop**: Propose representative test cases, edge cases, and static compiler/output assertions to continuously validate the prompt.

## Watertightness Audit Framework (Constraint Satisfaction)

To guarantee that a composed instruction set will not be ignored, bypassed, or violated under runtime/context pressure, calculate the **Watertightness Index ($W$)** on a scale of `0.0` to `10.0` using this formula:

$$W = 10 \times P \times (1 - L) \times C$$

Where:
- **Semantic Precision ($P$)**: The operational objectivity of the rules.
- **Loophole Density ($L$)**: The presence of logical escape paths or excuses.
- **Behavioral Coupling ($C$)**: The direct observability of a violation.

### Scoring Rubrics (Strict Criteria)

#### 1. Semantic Precision ($P$)
* **`1.0` (Absolute Objective):** 100% objective, mathematically bounded instructions with zero subjective adjectives. Employs explicit string-matching vetos or strict structural requirements.
* **`0.8` (Domain Bounded):** Clear rules, but relies on established standard domain terminology (e.g., "REST-compliant status codes", "W3C semantic tags") that carries minor interpretive overhead.
* **`0.5` (Subjective Prose):** Contains fuzzy, undefined adjectives (such as "clean", "concise", "complete", "elegant", "optimal").
* **`0.0` (Vague Intent):** Dense prose focusing on intent rather than mechanics (e.g., "try to write high-quality code").

#### 2. Loophole Density ($L$)
* **`0.0` (Zero Escape Paths):** Negative guardrails explicitly block all possible workarounds, cosmetic mimicry (e.g., "banning CSS overrides to mask wrong HTML tags"), and conversational excuses (e.g., forbidden string quotes for "quick shortcut").
* **`0.2` (Weak Guardrails):** Basic "do not do X" rules are present, but lacks explicit blocks on deceptive surface mimicry or faking syntax.
* **`0.5` (Conditional Escape Hatches):** The prompt explicitly includes fallback clauses that allow the model to bypass the standard (e.g., "if too difficult, do X instead" or "use stubs/placeholders when appropriate").
* **`1.0` (No Negative Boundaries):** No negative guardrails or forbidden states are defined. The model is completely free to decide when to bypass the rule.

#### 3. Behavioral Coupling ($C$)
* **`1.0` (Static/State Coupled):** Violations result in statically observable states, such as compilation/linter failures, specific tool budget blocks, or forbidden string output.
* **`0.7` (Output Coupled):** Violations are observable in the emitted file structures or visual rendered assets, but require runtime execution or rendering to verify.
* **`0.4` (Conversational Coupled):** Violations are only observable through manual code review or deep dialog flow.
* **`0.0` (Uncoupled):** Abstract guidelines that do not affect the output properties directly (e.g., "always keep the end user in mind").

### Audit & Redesign Workflow
1. **Identify the Core Rules**: List each separate instruction in the draft.
2. **Assign Ratings**: Apply the exact rubrics above to calculate the $P$, $L$, and $C$ values.
3. **Calculate the Index**: Run the watertightness equation to get the $W$ score.
4. **Close the Leakage**: If $W < 9.0$, identify the specific loopholes ($L$) or weak semantic precision ($P$) that caused the leakage, and write surgically precise, negative-guardrail rules to close them until $W \ge 9.0$.

## Design Decisions (Agnostic Prompt Architecture)

### 1. Ground the Model with Objective Data (Improves $P$)
- Avoid fanning out into general-purpose knowledge. Supply the exact source material, schemas, and standards needed for the task.
- Explicitly define the grounding boundary: State whether the model is restricted *only* to the supplied context, or if it may draw on background knowledge.
- For long-context grounding, place the instructions and final question *after* the bulk data to maximize attention retention.

### 2. Make the Output Contract Explicit (Improves $C$)
- Specify the exact sections, schema, citations, allowed output formats, and token limits.
- State exactly what to do when information is missing, blocked, or ambiguous, leaving zero room for speculation.
- If a task only requires a delta, patch, or classification, explicitly restrict the output to that slice instead of permitting a full rewrite.

### 3. Deliberate Use of Reasoning Scaffolds (Improves $L$)
- Do not add verbose reasoning steps (like "think step-by-step") to simple, statically coupled tasks—it wastes tokens and increases instruction-following drift.
- Request intermediate reasoning ONLY when the workflow requires that specific audit log.
- For complex, error-prone loops, use structural milestones or checkpoints (e.g., "First verify X, then perform Y") instead of raw prose.

### 4. Direct Tool & Agent Guardrails
- If the prompt controls tools, define exactly when tools are required, when to stop, and what must be verified before finalizing.
- Allow parallel execution only for independent steps, and require explicit permission checks before executing executing irreversible or external actions.

## Prompt Skeleton

Use a simple, cleanly delimited structure:

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

## Anti-Patterns to Avoid

- **Vague Adjectives**: Using words like `better`, `interesting`, `short`, or `detailed` without concrete, measurable parameters (Collapses $P$ to `0.5` or lower).
- **Loose Boundaries**: Letting the model decide when to follow a rule by omitting negative guardrails (Spikes $L$ to `0.5` or higher).
- **Uncoupled Intentions**: Instructing the model to "feel" or "aim" for a certain style instead of binding rules directly to syntax or output structures (Collapses $C$ to `0.0`).
- **Cargo-Cult Scaffolds**: Copying heavy Chain-of-Thought or reasoning blocks into simple tasks where direct, structured instructions are more reliable.

## Deliverables

When asked to produce or revise a prompt:
1. **The Final Composed Prompt**: Cleanly structured and delimited.
2. **The Watertightness Audit Report**: Explicit $P$, $L$, and $C$ ratings with the final $W$ index calculation and a description of closed loop leakages.
3. **The Verification Plan**: A short list of suggested test cases and static compile/output assertions.
