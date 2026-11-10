---
name: prompt-writer
description: Use whenever asked to generate, write, rewrite, or improve instructions for AI agents, including prompts, rules, workflows, AGENTS.md guidance, commands, and skill instructions.
author: alexgorbatchev
metadata:
  created_on: 2026-07-22 08:45
  last_modified: 2026-11-10 11:06
  status: current
---

## Execute the task

1. Inspect the request, existing instructions, and target runtime. Identify the required outcome, available inputs, authorization, and applicable artifact conventions. Infer what the context establishes; ask only for missing information that materially changes the result.
2. Before revising, identify the obligations, permissions, exceptions, and completion conditions to preserve. Apply later clarifications to the whole affected proposal, not just its newest sentence. Distinguish approved changes from suggestions and rejected alternatives.
3. Place each rule with its owner under **Policy ownership**. Draft only the instructions needed for execution, using **Token economy** and **Structure and authorization**.
4. Review under **Acceptance checks**, fix concrete failures, and run the artifact's required validation. Verify that every prior requirement was preserved, deliberately changed under authorization, or relocated with working routing.
5. Deliver the requested artifact or edit. Summarize the behavioral change, checks actually run, and unresolved limitations; do not repeat a file's full contents unless requested.

## Token economy

Write for an executing agent. Every passage must change a decision, supply required context, or prevent a concrete failure. Remove lectures, general knowledge the agent already has, repeated rationale, redundant examples, and meta-commentary.

Preserve explicit actions, authorization boundaries, validation, recovery, and completion conditions even when they seem obvious. Do not remove a required repair step on the assumption that review implies repair. Compress wording without weakening obligations.

Use direct instructions. Use numbered steps only when order matters and bullets for independent rules. Keep examples only when they resolve an ambiguity the rule alone does not. Use descriptive links; add text only for routing information the link does not convey. Use tables only when their columns contribute distinct information.

## Policy ownership

Keep cross-task behavior in shared instructions, domain rules in the owning domain skill, and task-specific requirements in the task. Keep runtime-specific contracts in the appropriate runtime layer.

When another skill owns a required workflow, name it and specify when to load it before the dependent action. Keep only local requirements and exceptions in the caller; do not copy the owner's procedure or command documentation. Define missing-dependency behavior: consult authoritative help when it supplies the required contract, otherwise suspend only dependent work and state what is needed. Do not duplicate the workflow as a fallback.

Remove overlap with baseline agent behavior only when the target environments reliably supply the same obligation. Preserve user preferences and explicit authorization; do not infer cross-runtime guarantees from one agent's defaults.

When moving a rule, update affected references and ensure the owner's trigger covers every task that needs it. Leave a loading condition where required so the rule reaches the agent before the affected decision.

## Structure and authorization

- Use the smallest structure that makes the task executable. Add role, context, examples, schemas, citations, output sections, or token limits only when they constrain a real requirement. Do not impose a fixed prompt skeleton.
- Specify authoritative sources and whether other knowledge is allowed when correctness depends on that boundary. Delimit supplied data from instructions; organize long inputs so the task and relevant constraints remain easy to locate.
- Match specificity to failure risk: exact commands or sequences for fragile operations, decision criteria where multiple implementations are valid. Require tools, checkpoints, or audit evidence only where the workflow needs them; do not request private reasoning traces.
- Carry existing authorization forward. Define when to act, when to escalate, and what evidence completes the task. Distinguish review-only requests from authorized implementation; reporting or creating a ticket must not substitute for authorized repair.
- Define recovery and continued independent work for missing inputs or failed checks. Ask only when a required decision or action lies outside existing authorization. Allow parallel work only for independent operations.
- For a requested patch, delta, or classification, constrain the output to that result rather than expanding it into a full rewrite.

## Acceptance checks

Review the resulting instructions against these checks:

- **Execution:** Are the action, required inputs, source boundaries, and completion evidence available and unambiguous?
- **Preservation:** Are obligations, permissions, exceptions, and approved clarifications preserved throughout the affected instructions? Do relocated rules remain discoverable?
- **Consistency:** Do rules, examples, references, and output requirements agree?
- **Literal compliance:** Could an agent obey the text while leaving the intended outcome unfinished? Check for reporting instead of authorized repair, tickets instead of implementation, redundant approval requests, or success without validation.
- **Recovery:** Does missing information or a failed check lead to an actionable blocker and continued independent work rather than abandonment or invented results?
- **Value:** Does each passage affect execution? Remove explanations of familiar concepts and repeated rules without deleting requirements.

Walk through a normal task, missing required information, and a conflicting or out-of-scope request. State the expected action for each; use actual execution where available. A textual walkthrough is not proof of runtime behavior.

Use at most two review-and-fix rounds. Finish when these checks and required artifact validation pass. If a required check still fails, preserve the work, report the specific blocker without claiming completion, and continue independent authorized work. Do not assign numerical quality scores or iterate for stylistic perfection.
