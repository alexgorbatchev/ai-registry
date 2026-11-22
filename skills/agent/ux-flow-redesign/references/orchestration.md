# Orchestrating units

- [Unit design](#unit-design)
- [The unit prompt](#the-unit-prompt)
- [Checkpoints and resume](#checkpoints-and-resume)
- [Delivery](#delivery)
- [Barriers](#barriers)
- [Shapes](#shapes)
- [Sizing](#sizing)
- [Services](#services)
- [Failures](#failures)
- [Ownership](#ownership)
- [Without parallel agents](#without-parallel-agents)

Use this for every unit, parallel or sequential, whether agents, a workflow engine or one session runs them. Assume any agent, service or host can die at any moment: a stalled model request, a provider outage, a session time limit, a reboot. Small resumable units that deliver as they finish are the only defense; a run whose agents work for hours and write at the end loses everything to one interruption.

Run a long orchestration (a workflow run, a script or an orchestrating agent that launches units) in a process or agent thread independent of the interactive session the owner talks to: a detached or supervised run, or a separate agent thread whose lifetime does not depend on the conversation. Interrupting, compacting or restarting the conversation must not stop in-flight units; the conversation starts the run, reads its checkpoints, and resumes it with a skip list.

Paths follow SKILL.md "Artifact layout and naming": run records live under `<state>/` (committed), machine-local files under `<local>/`, and `<docs>` is the served docs directory. Unit keys follow SKILL.md "ID conventions". Unit prompts give every script as `bun <skill>/scripts/<name>.ts` run from the project root, with `<skill>` expanded to the skill's absolute directory and project paths relative to the project root or absolute.

## Unit design

Make each unit one of:

| Phase | Unit key | Unit | Handoff |
| --- | --- | --- | --- |
| 2 | `review-<area>` | one review area (a slice of roster features) or one end-to-end journey, with `review`, `blind`, `verify` and `deliver` stages | `findings/<area>.json`, `findings/<area>.blind.json` from its blind reviewer, then `findings/<area>.verdicts.json` from its verifier |
| 4 and 6 | `flow-<key>` | one flow, as a sequence of stages | the flow's checkpoint plus its artifacts |
| 5 | `audit-<dimension>`; `critique-<lens>`; `reference` | one audit dimension; one critique lens; the author's synthesis and revision | `patterns/audit-<dimension>.json`; `patterns/critique-<lens>.json`; `patterns.md` |
| 8 | `reconcile-<key>`; `integrate`; `critic` | one flow brought into line with the reference; the integration step; the completeness critic | conformed artifacts and the flow's conformance items done; the landed revision; a verdict per flow |
| 2 or later | `verify-<ticket>` | one delivered high-severity ticket to verify | checkpoint, and the verdict recorded on the ticket |

Phases 1, 3, 7 and 9 have no units: they run inline in the orchestrating context, and their output files (`flows.md`, `assignments.md`, the reference's section 5, `verification.md`) are their durable checkpoints; a restart continues from what those files record.

A restarted unit keeps its key so it resumes from its checkpoint. A deliberate rerun of a done unit, such as a completeness rerun of a zero-finding area, takes a suffixed key (`review-<area>-2`) so it does not read the earlier checkpoint as done.

Size every unit, and every stage of a staged unit, to about 30 minutes. Split by flow, entity or ticket, never by open-ended exploration of an area; when a brief would take longer, split it into two units instead of raising the budget. Scale targets to the unit: about 6–12 strong findings for a 30-minute review unit, one complete readable journey per diagram stage rather than every branch.

Allocate resources per unit in the orchestrator, deterministically from the unit key, so a restarted unit gets the same ones:

| Resource | Each unit owns | Prevents |
| --- | --- | --- |
| Output files | its own checkpoint, handoff and artifact paths; it never touches another unit's files | overwrites between units |
| App instance | its own port and its own preference or state store against the shared backend | one agent's saved view, sort or filter changing under another |
| Browser session | a session named `<unit-key>-<stage>` (`review-<area>-verify`, `flow-<key>-current`), closed at the end | shared tabs, cookies and focus |
| Screenshot directory | `<local>/shots/<unit-key>/` | name collisions and evidence that cannot be traced to its unit |
| Data sandbox | named records it may write, with enumerated limits | writes that corrupt other units' evidence |
| Diagram output directory | a fresh numbered directory per validation attempt (`<key>-<stage>-<n>`) | concurrent renders and stale receipts colliding |

When units share a backend, tell every agent that data outside its sandbox may change under it, and that this is never a product finding. Name the isolation artifacts that are not findings, such as a server label showing a loopback port.

Before the first unit launches, do these inline in the orchestrating context: sync the build under review to current code (a stale build invalidates the whole run), write and test the helpers and validators, measure capacity (memory headroom and per-instance cost), start and health-check the services, and fix the unit list with each unit's key and resources. Phase 2's evidence environment is in [review](review.md).

## The unit prompt

Every unit prompt contains, in this order:

1. **Shared context block**, identical in every prompt of the run:
   - the product and its ownership boundaries (which component owns which data and operations);
   - the problem this run solves;
   - input paths, naming every known irregularity ("flow `x` has no proposal file; use the Proposed section of its ticket body");
   - seed lists, such as known conflicts or prior finding titles, each marked "seeds, not the full list";
   - binding contracts by document and section name, never copied and never by line number;
   - recent product changes to expect, so agents do not report against stale assumptions;
   - owner-settled intent stated as prohibitions (illustrative, for a reporting app: "Never treat an export that includes archived reports as a defect; that is intended");
   - the write boundary: read-only except the files the task names; no pushes, and no commits except shape D's deliver stage; no tracker changes except the delivery step (see **Ownership**);
   - where evidence goes: every screenshot and other evidence file under the unit's absolute `<local>/shots/<unit-key>/` path, never in a checkout (the main checkout's root or a worktree), because browser tools resolve a relative path against their own working directory.
2. **Unit brief:** scope with roster IDs, every flow or journey end state to exercise, evidence locations, existing tickets it overlaps ("already covers X; add only new evidence"), and prior titles not to duplicate.
3. **Safety and write limits:** enumerated and countable ("apply at most 4 imports", "preview only, never apply moves or deletions", "merge at most 2 groups, then undo one"). Reads and previews are allowed anywhere. Never install or upgrade tools, change server settings, edit repository files outside named outputs, run state-changing Git commands, or start, stop or restart services.
4. **Evidence standard:** observe in the running app first, then read the code and cite `path:line`; pin the revision; mark every pain point with its finding, cited as SKILL.md "ID conventions" says; open every screenshot and confirm it shows the problem legibly before citing it. Phase details are in [review](review.md) and [diagrams](diagrams.md).
5. **Checkpoint instruction**, pasted verbatim with the unit's checkpoint and, for a unit whose work lives in a handoff file, that file:

   ```text
   CHECKPOINT (mandatory; agents in this run can be killed at any moment and restarted from this prompt): <files> record your progress. Read them first. If they exist, keep everything they record and continue with work they do not record; never start over. If your stage is already "done" and its output files exist, return immediately with their paths. After each finding, decision or step, rewrite the complete file so it is valid on every write. Keep entries compact so rewrites stay cheap. If you cannot finish, set "status": "blocked" in your checkpoint with "blocker" (the cause and its evidence) and "unblock" (the exact condition and next action) before returning.
   ```

6. **Handoff file and validator:** the exact path and command, for example `bun <skill>/scripts/validate-handoff.ts findings <state>/findings/<area>.json --feature-pattern '<roster ID regex>'`, with "fix the file and rerun until it prints OK, at most three times; if it still fails, return the validator output, in `environmentIssues` when the environment caused the failure (for example, screenshots could not be captured)". The orchestrator marks such a unit failed for re-queue.
7. **Environment-issue channel:** an `environmentIssues` field in the return for setup problems (service down, sandbox missing, isolation artifacts). They never become findings, and the agent never repairs shared services itself.
8. **Delivery step:** in the last agent of the unit's pipeline (the verifier of a review unit, the package stage of a flow), only when tickets are in scope and after its handoff validates: file through `issue-tracker` and record each ticket ID in the checkpoint (see **Delivery**).
9. **Budget:** about 30 minutes, with the target count, and "prefer fewer strong results over many weak ones".
10. **Structured return:** a small schema whose fields the orchestrator uses, such as `{unit, files, count, titles, delivered, environmentIssues}`. The durable file is the result; the return only points at it.

Handoff fields are owned by each kind's reference and enforced by the validator's messages: `findings` in [review](review.md#findings-file), `verdicts` in [review](review.md#verification), `audit` in [pattern reference](pattern-reference.md#audits) and `critique` in [pattern reference](pattern-reference.md#critique). Flow stages have no handoff kind. Their gate is the diagram tool's own validation passing, the folder lint (`bun <skill>/scripts/lint-wireframes.ts --site-root <docs> <docs>/ux-flows/wireframes`) reporting no errors for the flow's page, and the stage marked done in the flow checkpoint.

## Checkpoints and resume

Give every unit one durable checkpoint, `<state>/units/<unit-key>.json`, with a `status` of `pending`, `in-progress`, `done`, `blocked` or `failed`, and its drafts in `<state>/units/<unit-key>/`. A blocked or failed unit also records `blocker` and `unblock` (see **Failures**). A `committed` field holds the commit that published a stage's repository edits (the orchestrator's, except in shape D's deliver stage), or why they stay uncommitted when the project's Git workflow does not authorize the commit; a stage that edited repository files is done only once it is set.

- A review unit (`review-<area>`) records the status of its `review`, `blind`, `verify` and `deliver` stages; their work lives in the findings file, the blind review file, the verdicts file and the checkpoint's `tickets` map (finding ID to ticket ID; a merged finding maps to its survivor's ticket), each rewritten after every finding, verdict or filed ticket.
- An audit or critique unit keeps its work in its handoff file, rewritten after each decision or issue; its checkpoint holds the status.
- A flow (`flow-<key>`) records its stages:

  ```json
  { "unit": "flow-<key>", "status": "in-progress",
    "stages": {
      "current":  { "status": "done", "json": "…", "html": "…", "revision": "<sha>", "validationReceipt": "…", "notes": "attempts, finding → ticket map" },
      "proposed": { "status": "in-progress", "json": "…", "html": "…", "proposal": "…", "wireframe": "…", "notes": "contract changes, backend work, priority" },
      "publish":  { "status": "pending", "published": null },
      "package":  { "status": "pending", "shots": {}, "ticket": null,
                    "links": { "proposal": false, "wireframeNav": false, "indexCard": false, "docsIndexRow": false },
                    "blockedBy": {}, "committed": null } } }
  ```

  `published` holds the orchestrator's commit of the flow's files, or `"unauthorized"` (see shape B). `blockedBy` maps each covered ticket in `assignments.md` to `linked`, or to `skipped` with the instruction that forbids the [tracker restructure](proposals-and-tickets.md#tracker-restructure). When tickets are in scope, the package stage is done only when `ticket` is set, every `links` entry is true, every covered ticket is in `blockedBy` and `committed` is set; otherwise it is done when the nav still reads "not filed yet" and the report lists the flow.
- A reconcile unit (`reconcile-<key>`) records `reconcile`, `review` (one entry per round), `fix` and `deliver` stages; the deliver stage records `committed` and keeps its steps (final after screenshots, commit, criteria check, ticket created or updated, attachments, blockers, priority) in its checkpoint so a restart repeats none. The integration step keeps `units/integrate.json`, recording each of its steps (shape D, Integrate) with the reference's base and target revisions, the re-checked flows, the regenerated diagrams, one `{spec, blob, attachment}` record per ticket image, the landed revision and the branch deletion; the completeness critic keeps `units/critic.json`.
- A long Markdown document written by one author (the pattern reference, unit `reference`) is written section by section; a restarted author continues it.

Resume in two layers:

1. **The orchestrator** computes completed units and stages from durable outputs only: the checkpoint marks it done, its output files exist and any handoff validates. It passes them as a skip list in the run arguments, because workflow scripts may not be able to read files: a `<unit-key>` token for a unit whose last stage is done, a `<unit-key>:<stage>` token for a finished stage of an unfinished unit. A skipped stage returns a stub with its existing paths so later stages still get their inputs. A recorded ticket ID means filed, not done: a rerun of that package stage runs only the missing link, `blockedBy` and commit steps and never files again.
2. **The unit** reads its checkpoint first, returns immediately when its work is already done, and runs its validator before every return; output that fails validation is not done.

When an engine resumes a run by replaying recorded results, it can replay only calls that finished; every call that was in flight reruns from its prompt, and its progress survives only in its checkpoint. Skip a stage only when the stage that consumes it reads a durable file: skipping critique while rerunning revision hands the author no issues unless the critique files exist on disk.

## Delivery

When tickets are in scope, deliver each verified unit inside its own pipeline: a review unit files its findings as soon as its verifier finishes, and a flow files its redesign ticket in its package stage once the orchestrator records `published`. Nothing waits for other units' work, for barriers or for the end of the run. Stay inside the authorized scope and stop at an explicit hold such as "show me before filing".

- File through `issue-tracker` and record each ticket ID in the unit checkpoint as soon as it exists.
- Edit shared pages (the wireframe index, the docs index) and run `scaffold-flow.ts`, which links into them, only serially from the orchestrator; parallel units otherwise overwrite each other's cards and rows.

## Barriers

Wait for all units only when the work needs every unit's output: cross-unit dedupe, the pattern reference author's synthesis, the completeness critic and shape D's cross-flow check.

- Run a barrier over the units that exist. Filter to units with valid handoffs, log the missing ones (`WARNING: audits missing for <keys>`), and tell the barrier agent to read those units' sources directly.
- Never hold delivery behind a barrier. Give every unit the existing-ticket digest and prior titles so it dedupes before filing; the later dedupe barrier records each duplicate on its delivered ticket through `issue-tracker` ([review](review.md#dedupe)).
- Run the completeness critic ([review](review.md#completeness)) after the first wave and again later; it needs no browser, and its gap units run the same pipeline with the prior titles. Also have it check that every user goal has exactly one owning unit; a capability reached from several flows that none owns end to end is a gap.

## Shapes

In the pseudocode, `pool(items, n, fn)` is a bounded worker pool that catches each item's failure as null, `parallel` runs independent calls together, and `skip` is the run's skip list of unit keys. Run shapes that share no data at the same time, for example a gap round, a re-run journey and shape F.

### A. Review pipeline

Use for Phase 2. Each unit's verifier starts as soon as its review returns, with its own instance and session, and tries to refute the findings.

```text
units = review-<area> for each roster slice and end-to-end journey - skip
pool(units, n, unit =>
  review(unit)  -> <state>/findings/<area>.json            # checkpointed; validate findings
  blind(unit)   -> <state>/findings/<area>.blind.json      # fresh reviewer, matrix frames only; triaged into the findings file
  if no findings: return {unit, count: 0, coverage}
  verify(unit)  -> <state>/findings/<area>.verdicts.json   # reproduces every P0 and P1; validate verdicts
  deliver(unit) -> tickets through issue-tracker; IDs in units/review-<area>.json)
after wave 1: critic(coverage, titles, filed tickets, roster) -> gap units -> same pipeline
dedupe(units that exist) -> duplicates recorded on delivered tickets
```

The findings validator rejects an empty findings list, so a unit that exercised its brief and found nothing records `"count": 0` and its coverage in its checkpoint as done, and the skip list includes it; [review](review.md#findings-file) says when the completeness pass reruns it, under a suffixed key.

### B. Per-flow redesign pipeline

Use for Phases 4 and 6. Stages run in order within a flow; flows run in a bounded pool, so one flow can be filing while another is still drawing its current diagram.

```text
pipeline(flow):                                                   # unit flow-<key>
  current(flow)  -> <key>-current.json + render                  # Phase 4
  proposed(flow) -> <key>-proposed.json + render, proposals/<key>.md, wireframes/<key>.html (lints clean)
  publish(flow)  -> orchestrator, serially: commit and push the flow's files; published: <commit>
  package(flow)  -> screenshots of both renders (opened and checked);
                    tickets in scope: file the redesign ticket through issue-tracker, record its ID, links and
                    blockedBy; the orchestrator commits the link edits (done only when all are recorded); otherwise stop
current(exemplar); proposed(exemplar); check it against the reference and fix it; publish(exemplar); package(exemplar)
pool(flows - exemplar - skip, n, pipeline)   # a failure returns {key, failed: stage} and records its blocker; other flows continue
```

- **Publish.** The package stage starts only once `published` is recorded, because SKILL.md "Scope boundaries" requires a flow's docs to be published before a ticket links them. When the project's Git workflow does not authorize publishing, record `published: "unauthorized"` and follow that rule's "not published yet" fallback.
- The proposed stage needs the published pattern reference (Phase 5). Run current stages earlier, alone or beside shape C, and let the checkpoints skip them later.
- Split the wireframe into its own stage when the proposed stage would exceed about 30 minutes.
- Agents validate diagrams as [diagrams](diagrams.md#running-archify) directs; a defect that survives the repair limit blocks the stage (see **Failures**).

### C. Pattern reference

Use for Phase 5, before any parallel design, and as recovery when flows were already designed in parallel without a reference (then run shape D). Units: `audit-<dimension>`, `critique-<lens>`, and `reference` for the author's writing and revision.

```text
factcheck = start parallel(P0 claims x angles, skeptic)              # joined at the end
audits    = parallel(dimensions - skip, d => audit(d) -> <state>/patterns/audit-<d>.json)   # validate audit
log dimensions without a valid audit; tell the author to read their sources directly
author(audits that exist) -> patterns.md, written section by section
issues    = parallel(lenses - skip, l => critique(l) -> <state>/patterns/critique-<l>.json) # validate critique; no edits
same author revises(issues) -> every issue applied or rejected with a reason, as numbered review notes
publish   -> wireframes/patterns.html; lint
await factcheck -> verdicts to the author and the owner
```

- [Pattern reference](pattern-reference.md) defines the dimensions, the reference's sections, the critique lenses and the [fact-check](pattern-reference.md#fact-checking-a-high-severity-claim) the skeptics run.

### D. Reconcile

Use for Phase 8, once every reviewed owner decision is settled. One `reconcile-<key>` unit per flow in a bounded pool, each a sequential pipeline; one integration step and one completeness critic after all flows.

```text
skip = reconcile-<key> units whose deliver stage is done, plus integrate and critic when done   // passed in on every rerun
pool(flows - skip, n, flow =>                  # units/reconcile-<key>.json
  reconcile(flow)  -> proposal, wireframe, <key>-proposed.json (validated, never rendered); before and after screenshots
  review(flow)     -> two reviewers in parallel: (a) reference conformance and cross-artifact consistency,
                      (b) design language and rendering
  fix(flow)        -> apply valid issues, reject others with a reason; re-check blockers and majors only;
                      at most two rounds; unresolved issues travel with the delivery
  deliver(flow))   -> retake the after screenshots; commit the flow's files on the run branch without pushing;
                      regenerate the ticket's criteria and covers from the proposal, attach the before and final
                      after screenshots, list unresolved issues; apply the tracker restructure for this flow
integrate          -> one agent (units/integrate.json): rebase onto the target branch; diff the reference since the
                      run's base and re-check the flows it affects (reconcile-<key>-2, same pipeline); regenerate
                      changed diagrams once; re-render and re-upload their ticket images; shared files and the
                      ledger; checks; land; delete the run branch
critic             -> one agent (units/critic.json): each flow complete or its concrete gaps, plus process changes worth keeping
```

- **Workspace.** A dedicated worktree on a run branch; never edit or commit in the main checkout. Flow units share the worktree, so each touches only its flow's files (proposal, wireframe, `<key>-proposed.json`, and `<key>-current.json` only when factually wrong) and never stashes, resets, checks out other files, rebases or pushes. A unit's push would publish the other units' commits too, and the integration rebase would then leave a remote run branch that only a force push could update. Generated diagram HTML and shared files (wireframe index, docs index, the reference's conformance section) belong to the integration step: flow units edit specs only, never render or hand-edit diagram HTML, and before committing validate each changed spec without rendering it ([diagrams](diagrams.md#running-archify)), so integration renders it unchanged. Wireframe screenshots can use `file://` URLs from the worktree, because the stylesheet link is relative.
- **Reconcile.** Capture before screenshots; read the reference's sections 2 to 5, the flow's conformance entry, the common items and every decision-log entry naming the flow; apply every P and W item, then make the four artifacts agree with every applicable rule, not only the listed items. Record each change with its rule or entry ID in the checkpoint. Leave the ticket untouched until delivery. Capture after screenshots and fix layout problems.
- **Review.** Both reviewers are adversarial and edit nothing; they quote locations. Blocker: contradicts an approved decision or a rule's required behavior, or leaves the page misleading or broken. Major: a missing required item, a contradiction between the flow's artifacts, or a design-language violation. Minor: wording or an ID citation. They also list conventions the reference lacks that the flow needed, for the critic.
- **Deliver.** The one stage in the skill where a unit commits. Every step is idempotent through its checkpoint.
  1. Retake the after screenshots of the final pages into the unit's shots directory: fix rounds change the pages, so after screenshots taken earlier are stale and never attached.
  2. A flow without a ticket gets one through `issue-tracker` when tickets are in scope (otherwise the report lists the flow); record the ID at once and [link it](proposals-and-tickets.md#linking-the-ticket).
  3. Commit only the flow's files on the run branch (`git commit -F <message file> -- <files>`, retrying while another agent holds the index lock), without pushing, and record `committed`.
  4. When the flow has a ticket, regenerate its criteria from the reconciled proposal and check them ([acceptance criteria](proposals-and-tickets.md#acceptance-criteria)), copy its covers from the proposal's **Tickets resolved** and check the wireframe's Fixes lines against them (`ticket-criteria.ts fixes`), attach the before screenshots and the final after screenshots only, and list any unresolved issues on it. Diagram images wait for the integration step, which renders the diagrams.
  5. Apply the [tracker restructure](proposals-and-tickets.md#tracker-restructure) for this flow.
- **Integrate.** The orchestrator's serial publish step for the run, and the only writer once the flows finish. Record each step in `units/integrate.json` as it completes:
  1. **Rebase first.** Fetch and rebase the run branch onto the target branch, resolving conflicts by keeping both sides; specs may cite revisions only the target branch has.
  2. **Reconcile against the reference as it stands now.** Diff the pattern reference (`patterns.md` and `wireframes/patterns.html`) from the run's base to the rebased tip. When it changed, list the flows the change affects (their conformance entry, decision-log entries naming them, or rule and `O<n>` IDs their artifacts cite) and run each through this shape's pipeline again as `reconcile-<key>-2` against the new revision before landing. Record the base, the tip and the re-checked flows. A contradiction a re-check cannot resolve lands as an unresolved issue on the ticket and in the ledger.
  3. **Regenerate once.** Regenerate every diagram whose spec changed on the run branch, once each, one after another in one browser session, and verify each render ([diagrams](diagrams.md#running-archify)). A spec that fails here missed its unit's validation: bring it within the tool's limits and record the change.
  4. **Ticket images.** For every regenerated diagram whose ticket carries an image of it, render the image from the committed spec ([rendering for inspection](diagrams.md#rendering-for-inspection)), open it, upload it through `issue-tracker` in place of the old one, and record `{spec, blob, attachment}` with `blob` from `git rev-parse HEAD:<spec>`. The step passes only when every such diagram has a record whose blob equals the spec's blob in the commit being landed; redo any image whose spec a later rebase changed.
  5. **Shared files.** Update the wireframe index, the docs index and each flow's line in the reference's reconciliation ledger ([per-flow conformance](pattern-reference.md#synthesis)).
  6. **Strays.** `git status --porcelain` in the run worktree and the main checkout must show no screenshot or other evidence file the run created; move the run's strays into its shots directory and record them.
  7. **Check and land.** Run the project's checks, the wireframe linter and the crawl; commit with `git commit -F`; land through the project's integration workflow. On a rejected push, fetch, rebase, repeat steps 3 and 4 for specs the rebase changed, re-run the checks and retry; never force-push. Fast-forward the main checkout only when it is clean.
  8. **Delete the run branch.** Once landed, delete the run branch, and its remote copy if one was ever pushed, and remove the worktree through the project's Git workflow. Record the landed revision, each flow's commit and unresolved issues, and the checks with durations.
- **Critic.** Checks every flow on the default branch: artifacts changed and diagrams regenerated, the wireframe passes the linter, `ticket-criteria.ts check` passes on the ticket against the landed proposal and `ticket-criteria.ts fixes` against the landed wireframe, the covers use the two categories and match the proposal, every regenerated diagram's ticket image record matches the landed spec's blob, the ledger holds the run's line, the flows were checked against the reference revision that landed, and covered findings, foundations and priorities follow the [tracker restructure](proposals-and-tickets.md#tracker-restructure). It reports each flow as complete or with concrete gaps, which become the next run's units.

### E. Salvage dead units

Use when units died with screenshots or transcripts on disk but no valid handoff. Mining their artifacts takes minutes; rerunning their exploration takes hours. Salvage agents follow [review](review.md#salvage).

```text
for each dead unit: digest = condensed transcript
pool(dead units with usable evidence, n, unit =>
  salvage(screenshots, digest, code) -> findings file; validate; verify; deliver)
dedupe(units that exist)
units with nothing usable -> re-queued as first-class units of the next run
```

### F. Verify delivered high-severity items

Use after filing for each delivered P0 ticket, as [review](review.md#verification) describes, and whenever high-severity tickets were delivered before an independent verifier saw them.

```text
pool(verify-<ticket> for delivered P0 tickets - skip, n, ticket =>
  verify(ticket) from a clean state, own instance and session    # units/verify-<ticket>.json records each step
  -> verdict in the checkpoint -> recorded on the ticket through issue-tracker)
```

## Sizing

- Run heavy units (an app instance with a browser, a diagram render) one at a time; at most one other unit runs beside it, and only basic work such as reading files, reviewing finished screenshots or editing text. Before each heavy start, require the 1-minute load average below the CPU core count, memory not under pressure, and at least 8 GiB of free disk, raised to the heavy unit's measured footprint. When a check fails, start nothing until the running unit finishes and the checks pass.
- Log every coverage cut (a capped unit list, a dropped dimension, a skipped journey) in the run's output and in the owner report.
- Use one author for synthesis and revision so the result reads as one system. Parallelize only independent reads: reviews, audits, critiques, skeptics and verifiers.

## Services

- Start every service the units depend on (app instances, the backend, the docs server) outside the session's background tasks, which end at their time limits and with the session. Use an idempotent command that runs it detached or supervised: a terminal multiplexer, the OS service manager, or the dev runner's detached start that waits for readiness.
- Health-check each service before launch and again on resume: every allocated instance port and the backend must answer.
- Agents never start, stop or restart shared services. On an outage they record it in `environmentIssues`, stop the work that depends on it, and never report outage behavior as a product finding.
- Keep launch scripts and helpers under `<state>/tools/` and run validators from `<skill>`; a reboot wipes session temp. A reboot still kills every service, so resumable units are what survives it.

## Failures

- Catch each unit's failure as null (`{key, failed: stage}`) so one dead unit never kills the run; the run's return lists the failed units.
- Gates apply per unit. A unit that cannot pass its gate is `blocked` in its checkpoint, with `blocker` (the verified cause and its evidence) and `unblock` (the exact condition and next action). When an agent died without writing that, the orchestrating session marks the unit `failed` with the same fields after reading its termination record. Hold only the units that depend on it, continue the others, and list every blocked or failed unit in the report; the effort is not complete while one remains.
- Before naming why a unit died, read its own termination record: exit status, log tail, final transcript entries. Timing correlation is only a hypothesis; report verified causes separately from hypotheses. For example, in one harness a model request that hung about ten minutes was aborted by a watchdog and logged as interrupted by the user. Treat such a marker as a watchdog abort only when the termination record and the harness's documentation or logs confirm it; until then it is a hypothesis, and in another harness it may record a real user interrupt.
- An engine may restart an aborted agent from its prompt; its checkpoint carries it forward.
- After a provider outage or a reboot, health-check the services, compute the skip list and relaunch.
- Re-queue every unit that died without producing anything usable as a first-class unit of the next run, with its own key and budget, never folded into another unit's brief.
- Watch unit checkpoints while the run is going. When units stop delivering, diagnose immediately; a run that goes hours without a delivered unit is failing.

## Ownership

- Follow `issue-tracker` for the claim and handoff of the run's own task.
- Units write only the paths their task names, with repository artifacts in a clean worktree. The orchestrator reviews their output, moves scratch artifacts into the repository and publishes it (shape B's publish step and each `committed` field); who commits and pushes follows SKILL.md "Scope boundaries", and shape D's integrate step lands the run branch. Ticket changes through `issue-tracker` are a unit's only other external side effects.

## Without parallel agents

- Run the same units one after another in risk order, with the same checkpoints, validators and per-unit delivery.
- Keep every barrier and its order: the pattern reference before any Phase 6 design, the cross-flow check before final delivery.
- Run verification, critique and fact-checks as separate passes after the producing pass, starting from a fresh read of the evidence (reopen the screenshots, reread the code and files), never from memory of producing it. Use a new session when one is available.
- One app instance and one browser session are enough; units still keep their own sandboxes and output files.
