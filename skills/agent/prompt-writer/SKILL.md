---
name: prompt-writer
description: Use whenever asked to generate, write, rewrite, or improve instructions for AI agents, including prompts, rules, workflows, AGENTS.md guidance, commands, and skill instructions.
author: alexgorbatchev
metadata:
  created_on: 2026-07-22 08:45
  last_modified: 2026-10-15 16:37
  status: current
---

## Workflow

Apply this workflow to AI agent instructions in any format or artifact. For skill bundles or project documentation, also follow the applicable artifact's structure and validation rules.

1. **Identify the Target Runtime**: Determine the interface constraints before drafting (system/developer/user roles, tool calling, structured outputs, or context limits).
2. **Define the Task**: Write instructions for an AI agent. Specify the action, available inputs, allowed sources, scope, and expected result.
3. **Choose the Lightest Skeleton**: Start with the smallest, most structured prompt shape that can work. Use consistent Markdown headers or XML-style tags.
4. **Compose from Labeled Blocks**:
   - `role`: who the model is for the task
   - `task`: the exact operational job
   - `constraints`: concrete rules the agent must follow
   - `examples`: representative input/output pairs that clarify edge cases
   - `output_contract`: exact return shape and fallback behaviors
5. **Review the Instructions**: Apply the checklist below and fix concrete failures.
6. **Verify the Result**: Use representative scenarios and available checks; distinguish executed checks from proposed ones.

## Agent Instruction Checklist

- **Action:** Can the agent identify what to do and what is outside the task?
- **Inputs:** Are required sources, tools, and references available or retrievable?
- **Consistency:** Do the rules, examples, and output requirements agree?
- **Completion:** Is there a concrete result and a way to check it?
- **Blocked work:** Does the agent know what to record, what would unblock it, and which independent authorized work can continue?

Walk through a normal task, a case with missing required information, and a conflicting or out-of-scope request. State the expected agent action for each. Use actual execution where available; a written walkthrough is a review, not proof of runtime behavior.

Review and fix at most twice. Finish as soon as the checklist passes. If a required item still fails after two rounds, report the specific unresolved blocker and preserve the draft without claiming completion. Continue independent authorized work. Do not assign quality scores or keep rewriting for stylistic perfection.

## Writing Rules

### Ground the Agent
- Avoid fanning out into general-purpose knowledge. Supply the exact source material, schemas, and standards needed for the task.
- Explicitly define the grounding boundary: State whether the model is restricted *only* to the supplied context, or if it may draw on background knowledge.
- For long-context grounding, place the instructions and final question *after* the bulk data to maximize attention retention.

### Define the Output
- Specify the exact sections, schema, citations, allowed output formats, and token limits.
- State exactly what to do when information is missing, blocked, or ambiguous, leaving zero room for speculation.
- If a task only requires a delta, patch, or classification, explicitly restrict the output to that slice instead of permitting a full rewrite.

### Keep Steps Useful
- Use direct instructions for simple tasks; add checkpoints only where order or verification matters.
- Request intermediate reasoning ONLY when the workflow requires that specific audit log.
- For complex, error-prone loops, use structural milestones or checkpoints (e.g., "First verify X, then perform Y") instead of raw prose.

### Define Tool Use and Authorization
- If the prompt controls tools, define exactly when tools are required, when to stop, and what must be verified before finalizing.
- Allow parallel execution only for independent steps. Use existing authorization for covered actions; ask only when a required action falls outside it.

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

- **Unclear Outcomes**: Asking for something `better` without describing the expected change or how to check it.
- **Conflicting Rules**: Giving incompatible actions or stop conditions without explaining which applies.
- **Unsupported Claims**: Treating a review checklist as proof of execution or a guarantee of model reliability.
- **Cargo-Cult Scaffolds**: Copying heavy Chain-of-Thought or reasoning blocks into simple tasks where direct, structured instructions are more reliable.

## Deliverables

When asked to produce or revise a prompt:
1. **The Final Composed Prompt**: Cleanly structured and delimited.
2. **Verification Summary**: Briefly state checks performed, expected actions for the scenarios, and any unresolved blockers. Do not add a score or a separate audit report.
3. **Further Checks**: List only material checks that still need execution, clearly marked as unrun.
