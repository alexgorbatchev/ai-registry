# AGENTS.md authoring

Load `prompt-writer` before composing or reviewing instructions. It owns wording, token economy, authorization, preservation, and acceptance checks. This reference owns repository evidence, instruction placement, and maintenance. Canonical `AGENTS.md` files are separate from persona files such as `.github/agents/*.md`.

## Execute the task

1. Read the requested files, applicable parent and nested instructions, and working diff. For repository-wide reviews, inventory local skills and referenced workflows, including instructions loaded by affected tasks. Distinguish authoritative sources from generated, linked, and vendored copies; edit the maintained owner and preserve upstream-owned content. Inspect the manifests, task recipes, CI, configuration, source examples, or maintained documentation needed to verify the affected claims. Scale discovery to the change; a local command correction does not require surveying every package.
2. Inventory existing requirements and technical details before restructuring: commands and flags, paths, contracts, configuration semantics, provenance and licensing, thresholds, exceptions, permissions, and completion conditions. Keep this inventory outside the delivered instructions.
3. Resolve each item against evidence and the instructions that load together. Check for competing task systems, copied shared procedures, stale tool capabilities, and local rules that contradict inherited exceptions. Preserve requirements that implementation does not yet satisfy. A recent edit or implementation mismatch does not authorize a policy change. Keep unresolved technical claims with uncertainty explicit, seek the missing decision, and continue independently resolved work.
4. Choose owners and destinations under **Placement**. For cleanup, rewrite, or conformance requests, rewrite the complete requested files from their preserved substance. For narrow corrections or review-only requests, stay within that scope. Use [structure options](../assets/agents-templates.md) only when helpful.
5. Write current instructions, applying **Standing rules**. Preserve established authorization and project gates; do not insert release permissions, commit restrictions, coverage thresholds, or other policies merely because a template contains them. Load `programming` when defining software testing or coverage requirements; keep repository-specific commands and exceptions here and shared policy with that skill. Establish each check’s direct and transitive inputs, where it can run, what it proves, and which acceptance or integration decisions depend on it. Reconcile blanket test mandates and extension-based exemptions with `programming`’s impact-based selection and measured-duration reporting. Preserve native-platform requirements; use suitable available environments without inventing PR or CI prerequisites. An unavailable environment suspends dependent acceptance, not independent work.
6. Map every inventory item to its exact replacement location, an equivalent existing owner with working routing, or an evidenced removal reason. Valid removals are equivalent duplication, demonstrated obsolescence, task-only narrative, or explicit user authorization. Length, inferability, and template fit do not justify dropping requirements or technical context.
7. Verify commands against their definitions, links against destinations, and loading conditions against the tasks that need them. Check preserved scope, exceptions, and rule strength; run applicable artifact checks and `prompt-writer` acceptance checks. Report changes, verification, and unresolved gaps outside the instruction files. Follow existing Git authorization.

## Placement

- Root: commands and checks selected by task, repository-wide constraints, cross-component contracts, and routes to specialized guidance. Inherit shared execution policy; record only local queue, integration, cleanup, and handoff requirements or exceptions. Verify that the shared owner is available in the target environment; use explicit routing where needed.
- Nested `AGENTS.md`: local commands, exceptions, and contracts that apply to that subtree. Add one when the local rules differ; avoid repeating inherited rules.
- References: detailed contracts or workflows needed only for particular tasks. Link each from the applicable instruction file with a condition that loads it before the affected decision. A link without a loading condition does not preserve an obligation.
- Domain skills: reusable workflows. Require their owner before dependent work; keep only project-specific requirements locally. `skill-writer` applies when editing skill bundles, not merely because `AGENTS.md` contains agent instructions.

Use only sections that carry real requirements or context. Keep exact technical details in the requested file when no suitable maintained destination exists. Relocate within authorized scope and update incoming links. Preserve established instruction filenames unless a migration is requested or required; do not overwrite compatibility files destructively.

## Standing rules

Automatically persist explicit standing user instructions in the narrowest applicable `AGENTS.md` or existing policy file. Update the existing rule in place when it changes; ask only when future scope or a material conflict remains unclear. Never infer permanent policy from a one-task request.

Write present-tense rules without task IDs, dated amendments, assignments, handoffs, progress, or test-run results. Preserve technical substance embedded in narrative. Keep resumable task state, active queue scope, temporary stop/closeout mandates, and handoffs in durable task records, decisions in existing decision records, and dependency provenance in maintained technical documentation; do not create documents just to relocate discarded narration.

When moving task state out of standing guidance, preserve active restrictions and the next action in the owning task record before removing them. Keep a durable loading route when agents need a restriction before selecting or publishing work. Do not interpret relocation as completion or cancellation of that task. Apply `prompt-writer`'s continuity checks to new project guides as well as revisions.

## Instruction maintenance and enforcement

Instruction maintenance, including committing and merging it, does not make newly specified but unimplemented enforcement a completion prerequisite. Record such gaps as follow-up work, run existing checks applicable to the actual change, and preserve existing gates and behavior-change testing requirements. Do not claim enforcement that was not verified. A user-deferred operation suspends only itself and actual dependents; continue independent authorized work.
