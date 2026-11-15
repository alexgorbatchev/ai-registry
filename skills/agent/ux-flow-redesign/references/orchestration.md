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

Paths follow SKILL.md "Artifact layout and naming": working files live under `<state>/ux-flows/` and `<docs>` is the served docs directory. Unit keys follow SKILL.md "ID conventions". Unit prompts give every script as `bun <skill>/scripts/<name>.ts` run from the project root, with `<skill>` expanded to the skill's absolute directory and project paths relative to the project root or absolute.

## Unit design

Make each unit one of:

| Phase | Unit key | Unit | Handoff |
| --- | --- | --- | --- |
| 2 | `review-<area>` | one review area (a slice of roster features) or one end-to-end journey, with `review`, `verify` and `deliver` stages | `findings/<area>.json`, then `findings/<area>.verdicts.json` from its verifier |
| 4 and 6 | `flow-<key>` | one flow, as a sequence of stages | the flow's checkpoint plus its artifacts |
| 5 | `audit-<dimension>`; `critique-<lens>`; `reference` | one audit dimension; one critique lens; the author's synthesis and revision | `patterns/audit-<dimension>.json`; `patterns/critique-<lens>.json`; `patterns.md` |
| 8 | `reconcile-<key>`; `integrate`; `critic` | one flow brought into line with the reference; the integration step; the completeness critic | conformed artifacts and the flow's conformance items done; the landed revision; a verdict per flow |
| 2 or later | `verify-<ticket>` | one delivered high-severity ticket to verify | verification receipt and one ticket comment |
| 2 and 6 | the producing unit's key | one ticket, or one unit's tickets, when filing runs apart from the unit that produced them | the producing unit's filing receipt |

A restarted unit keeps its key so it resumes from its checkpoint. A deliberate rerun of a done unit, such as a completeness rerun of a zero-finding area, takes a suffixed key (`review-<area>-r2`) so it does not read the earlier checkpoint as done.

Size every unit, and every stage of a staged unit, to about 30 minutes. Split by flow, entity or ticket, never by open-ended exploration of an area; when a brief would take longer, split it into two units instead of raising the budget. Scale targets to the unit: about 6–12 strong findings for a 30-minute review unit, one complete readable journey per diagram stage rather than every branch.

Allocate resources per unit in the orchestrator, deterministically from the unit key, so a restarted unit gets the same ones:

| Resource | Each unit owns | Prevents |
| --- | --- | --- |
| Output files | its own checkpoint, handoff and artifact paths; it never touches another unit's files | overwrites between units |
| App instance | its own port and its own preference or state store against the shared backend | one agent's saved view, sort or filter changing under another |
| Browser session | a session named `<unit-key>-<stage>` (`review-<area>-verify`, `flow-<key>-current`), closed at the end | shared tabs, cookies and focus |
| Screenshot directory | `<state>/ux-flows/shots/<unit-key>/` | name collisions and evidence that cannot be traced to its unit |
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
   - the write boundary: read-only except the files the task names; no commits or pushes except shape D's deliver stage, and no tracker changes except the delivery step (see **Ownership**).
2. **Unit brief:** scope with roster IDs, every flow or journey end state to exercise, evidence locations, existing tickets it overlaps ("already covers X; add only new evidence"), and prior titles not to duplicate.
3. **Safety and write limits:** enumerated and countable ("apply at most 4 imports", "preview only, never apply moves or deletions", "merge at most 2 groups, then undo one"). Reads and previews are allowed anywhere. Never install or upgrade tools, change server settings, edit repository files outside named outputs, run state-changing Git commands, or start, stop or restart services.
4. **Evidence standard:** observe in the running app first, then read the code and cite `path:line`; pin the revision; mark every pain point with its ticket; open every screenshot and confirm it shows the problem legibly before citing it. Phase details are in [review](review.md) and [diagrams](diagrams.md).
5. **Checkpoint instruction**, pasted verbatim with the unit's checkpoint and, for a unit whose work lives in a handoff file, that file:

   ```text
   CHECKPOINT (mandatory; agents in this run can be killed at any moment and restarted from this prompt): <files> record your progress. Read them first. If they exist, keep everything they record and continue with work they do not record; never start over. If your stage is already "done" and its output files exist, return immediately with their paths. After each finding, decision or step, rewrite the complete file so it is valid on every write. Keep entries compact so rewrites stay cheap. If you cannot finish, set "status": "blocked" in your checkpoint with "blocker" (the cause and its evidence) and "unblock" (the exact condition and next action) before returning.
   ```

6. **Handoff file and validator:** the exact path and command, for example `bun <skill>/scripts/validate-handoff.ts findings <state>/ux-flows/findings/<area>.json --feature-pattern '<roster ID regex>'`, with "fix the file and rerun until it prints OK, at most three times; if it still fails, return the validator output, in `environmentIssues` when the environment caused the failure (for example, screenshots could not be captured)". The orchestrator marks such a unit failed for re-queue.
7. **Environment-issue channel:** an `environmentIssues` field in the return for setup problems (service down, sandbox missing, isolation artifacts). They never become findings, and the agent never repairs shared services itself.
8. **Delivery step:** in the last agent of the unit's pipeline (the verifier of a review unit, the package stage of a flow), only when tickets are in scope and only after its handoff validates (see **Delivery**), with "report the created numbers".
9. **Budget:** about 30 minutes, with the target count, and "prefer fewer strong results over many weak ones".
10. **Structured return:** a small schema whose fields the orchestrator uses, such as `{unit, files, count, titles, delivered, environmentIssues}`. The durable file is the result; the return only points at it.

Handoff fields are owned by each kind's reference and enforced by the validator's messages: `findings` in [review](review.md#findings-file), `verdicts` in [review](review.md#verification), `audit` in [pattern reference](pattern-reference.md#audits) and `critique` in [pattern reference](pattern-reference.md#critique). Flow stages have no handoff kind. Their gate is the diagram tool's own validation passing, `bun <skill>/scripts/lint-wireframes.ts <page>` reporting no errors, and the stage marked done in the flow checkpoint.

## Checkpoints and resume

Give every unit one durable checkpoint, `<state>/ux-flows/units/<unit-key>.json`, with a `status` of `pending`, `in-progress`, `done`, `blocked` or `failed`, and its drafts in `<state>/ux-flows/units/<unit-key>/`. A blocked or failed unit also records `blocker` and `unblock` (see **Failures**). A `committed` field holds the commit that published a stage's repository edits (the orchestrator's, except in shape D's deliver stage), or why they stay uncommitted when the project's Git workflow does not authorize the commit; a stage that edited repository files is done only once it is set.

- A review unit (`review-<area>`) records the status of its `review`, `verify` and `deliver` stages; their work lives in the findings file, the verdicts file and the receipt, each rewritten after every finding, verdict or filed ticket. Its `deliver` stage records `committed` for Markdown tickets and `tickets/index.md`.
- An audit or critique unit keeps its work in its handoff file, rewritten after each decision or issue; its checkpoint holds the status.
- A flow (`flow-<key>`) records its stages:

  ```json
  { "unit": "flow-<key>", "status": "in-progress",
    "stages": {
      "current":  { "status": "done", "json": "…", "html": "…", "revision": "<sha>", "validationReceipt": "…", "notes": "attempts, finding → ticket map" },
      "proposed": { "status": "in-progress", "json": "…", "html": "…", "proposal": "…", "wireframe": "…", "notes": "contract changes, backend work, priority" },
      "publish":  { "status": "pending", "published": null },
      "package":  { "status": "pending", "shots": {}, "draft": "units/flow-<key>/ticket.md", "ticket": null, "receipt": "…",
                    "links": { "proposal": false, "wireframeNav": false, "indexCard": false, "docsIndexRow": false },
                    "blockedBy": {}, "committed": null } } }
  ```

  `published` holds the orchestrator's commit of the flow's files, or `"unauthorized"` (see shape B). `blockedBy` maps each covered ticket in `assignments.md` to `linked`, or to `proposed` when [Filing](proposals-and-tickets.md#filing) does not authorize the link; the owner report lists each `proposed` link as an ID'd action. When tickets are in scope, the package stage is done only when the receipt exists, every `links` entry is true, every covered ticket is in `blockedBy` and `committed` is set; otherwise it is done when the draft exists, the nav still reads "not filed yet" and the report lists the draft.
- A reconcile unit (`reconcile-<key>`) records `reconcile`, `review` (one entry per round), `fix` and `deliver` stages; the deliver stage records `committed` and keeps its steps (commit, push, ticket created or edited, comment, blockers, priority) in `receipts/reconcile-<key>.json`. The integration step and the completeness critic keep `units/integrate.json` and `units/critic.json`.
- A long Markdown document written by one author (the pattern reference, unit `reference`) is written section by section; a restarted author continues it.
- A verifier records each step in its receipt file so a restart does not repeat a posted comment.

Resume in two layers:

1. **The orchestrator** computes completed units and stages from durable outputs only: the checkpoint marks it done, its output files exist and any handoff validates. It passes them as a skip list in the run arguments, because workflow scripts may not be able to read files: a `<unit-key>` token for a unit whose last stage is done, a `<unit-key>:<stage>` token for a finished stage of an unfinished unit. A skipped stage returns a stub with its existing paths so later stages still get their inputs. A filing receipt means filed, not done: rerun a package stage that has a receipt but is not done, and it runs only the missing link, `blockedBy` and commit steps (the filer returns the recorded number).
2. **The unit** reads its checkpoint first, returns immediately when its work is already done, and runs its validator before every return; output that fails validation is not done.

When an engine resumes a run by replaying recorded results, it can replay only calls that finished; every call that was in flight reruns from its prompt, and its progress survives only in its checkpoint. Skip a stage only when the stage that consumes it reads a durable file: skipping critique while rerunning revision hands the author no issues unless the critique files exist on disk.

## Delivery

When tickets are in scope, deliver each verified unit inside its own pipeline: a review unit files its tickets as soon as its verifier finishes, and a flow files its redesign ticket in its package stage once the orchestrator records `published`. Nothing waits for other units' work, for barriers or for the end of the run. Stay inside the authorized scope and stop at an explicit hold such as "show me before filing". [Filing](proposals-and-tickets.md#filing) owns where tickets go, which tracker writes are allowed and when covered tickets may be blocked; without a tracker, the filer writes [Markdown tickets](proposals-and-tickets.md#markdown-tickets) with the same receipts and lock.

Receipts make delivery idempotent. Keep one receipt file per unit, `<state>/ux-flows/receipts/<unit-key>.json`, and save it after every create so a crash mid-batch resumes cleanly. Record epics, tickets keyed by finding ID (a merged finding records its survivor's number; a flow records its redesign ticket) and comments keyed by `<unit-key>:<ticket>`.

File only through a project filing helper. When the project has none, write one under `<state>/ux-flows/bin/` that implements these steps, and test it with the canary. The helper does, in order:

1. Exit 0 with the recorded number when the receipt already exists.
2. Embed the stable marker `<!-- ux-flow: <unit-key>:<item-id> -->` in the rendered body, where the item ID is the finding ID, `epic`, or the redesign ticket's ID.
3. Refuse a body that contains a scratch URL (an isolated instance's loopback address) or a private hostname.
4. Refuse when any image the body references is missing. With a tracker, attach every referenced image so the tracker hosts it; never commit them.
5. Take a cross-process lock with `mkdir <state>/ux-flows/receipts/.filing.lock`: poll every 2 seconds, reclaim a lock older than 30 minutes, give up after about 30 minutes, and remove it on exit. Re-check the receipt once the lock is held. With a tracker, search it for the marker and adopt a match into the receipt instead of creating.
6. Create the item and parse its number from the tracker's output with a strict pattern. Unparseable output is an unknown outcome, never a success: search for the marker before any retry. In Markdown mode, write the ticket file, then add its `tickets/index.md` entry when absent and any authorized `Blocked by:` line; the number is the ticket's ID.
7. Write the receipt only after the tracker confirms creation or the marker search finds the item, or, in Markdown mode, after step 6's files are written.
8. Keep the rendered body beside the receipt for audit.

- Without a tracker, the agent may act as the filer itself: check the receipt, take the lock when units run in parallel, write the ticket file and its index entry, run the [privacy scan](publishing.md#privacy) over them, then write the receipt.
- On every deliver-stage resume in Markdown mode, reconcile `tickets/index.md` against all receipts and add each missing entry.
- Edit shared pages (the wireframe index, the docs index, `tickets/index.md`) and run `scaffold-flow.ts`, which links into them, only while holding the same lock, or serially from the orchestrator; parallel units otherwise overwrite each other's cards and rows.
- Deliver a canary first: file one unit alone, open the created ticket in the tracker, check its title, labels, epic, body and images, fix the renderer, then file the rest.
- Treat a batch that finishes suspiciously fast as failed until its log shows each created number.
- Pass unit lists to helpers as separate arguments, never as one string. A shell that does not word-split an unquoted variable hands the helper one unknown unit, and nothing is filed. Have the helper print each unit it processes.

## Barriers

Wait for all units only when the work needs every unit's output: cross-unit dedupe, the pattern reference author's synthesis, the completeness critic and shape D's cross-flow check.

- Run a barrier over the units that exist. Filter to units with valid handoffs, log the missing ones (`WARNING: audits missing for <keys>`), and tell the barrier agent to read those units' sources directly.
- Never hold delivery behind a barrier. Give every unit the existing-ticket digest and prior titles so it dedupes before filing; the later dedupe barrier records duplicates as links or comments on delivered tickets ([review](review.md#dedupe)).
- Run the completeness critic ([review](review.md#completeness)) after the first wave and again later; it needs no browser, and its gap units run the same pipeline with the prior titles. Also have it check that every user goal has exactly one owning unit; a capability reached from several flows that none owns end to end is a gap.

## Shapes

In the pseudocode, `pool(items, n, fn)` is a bounded worker pool that catches each item's failure as null, `parallel` runs independent calls together, and `skip` is the run's skip list of unit keys. Run shapes that share no data at the same time, for example a gap round, a re-run journey and shape F.

### A. Review pipeline

Use for Phase 2. Each unit's verifier starts as soon as its review returns, with its own instance and session, and tries to refute the findings.

```text
units = review-<area> for each roster slice and end-to-end journey - skip
pool(units, n, unit =>
  review(unit)  -> <state>/ux-flows/findings/<area>.json            # checkpointed; validate findings
  if no findings: return {unit, count: 0, coverage}
  verify(unit)  -> <state>/ux-flows/findings/<area>.verdicts.json   # reproduces every P0 and P1; validate verdicts
  deliver(unit) -> epic, tickets, comments via the filing helper; receipts/review-<area>.json)
after wave 1: critic(coverage, titles, filed tickets, roster) -> gap units -> same pipeline
dedupe(units that exist) -> links and comments on delivered tickets
```

The findings validator rejects an empty findings list, so a unit that exercised its brief and found nothing records `"count": 0` and its coverage in its checkpoint as done, and the skip list includes it; [review](review.md#findings-file) says when the completeness pass reruns it, under a suffixed key.

### B. Per-flow redesign pipeline

Use for Phases 4 and 6. Stages run in order within a flow; flows run in a bounded pool, so one flow can be filing while another is still drawing its current diagram.

```text
pipeline(flow):                                                   # unit flow-<key>
  current(flow)  -> <key>-current.json + render                  # Phase 4
  proposed(flow) -> <key>-proposed.json + render, proposals/<key>.md, wireframes/<key>.html (lints clean)
  publish(flow)  -> orchestrator, serially under the filing lock: commit and push the flow's files; published: <commit>
  package(flow)  -> screenshots of both renders (opened and checked), ticket draft at units/flow-<key>/ticket.md;
                    tickets in scope: file via the helper, receipt, links and blockedBy, orchestrator commits the
                    link edits (done only when all are recorded); otherwise stop at the draft
current(exemplar); proposed(exemplar); check it against the reference and fix it; publish(exemplar); package(exemplar)
pool(flows - exemplar - skip, n, pipeline)   # a failure returns {key, failed: stage} and records its blocker; other flows continue
```

- **Publish.** The package stage starts only once `published` is recorded. [Filing](proposals-and-tickets.md#filing) step 1 owns why. When the project's Git workflow does not authorize publishing, record `published: "unauthorized"`; the ticket then says "not published yet" in place of repository links, and the report lists those tickets to edit once their files are published.
- The proposed stage needs the published pattern reference (Phase 5). Run current stages earlier, alone or beside shape C, and let the checkpoints skip them later.
- Hand designers the exemplar only after it conforms; an exemplar that breaks a rule spreads the break to every page drawn from it.
- Split the wireframe into its own stage when the proposed stage would exceed about 30 minutes.
- Agents validate diagrams as [diagrams](diagrams.md#running-archify) directs; a defect that survives the repair limit blocks the stage (see **Failures**).

### C. Pattern reference

Use for Phase 5, before any parallel design, and as recovery when flows were already designed in parallel without a reference (then run shape D). Units: `audit-<dimension>`, `critique-<lens>`, and `reference` for the author's writing and revision.

```text
factcheck = start parallel(P0 claims x angles, skeptic)              # joined at the end
audits    = parallel(dimensions - skip, d => audit(d) -> <state>/ux-flows/patterns/audit-<d>.json)   # validate audit
log dimensions without a valid audit; tell the author to read their sources directly
author(audits that exist) -> patterns.md, written section by section
issues    = parallel(lenses - skip, l => critique(l) -> <state>/ux-flows/patterns/critique-<l>.json) # validate critique; no edits
same author revises(issues) -> every issue applied or rejected with a reason, as numbered review notes
publish   -> wireframes/patterns.html; lint
await factcheck -> verdicts to the author and the owner
```

- [Pattern reference](pattern-reference.md) defines the dimensions, the reference's sections, the critique lenses and the [fact-check](pattern-reference.md#fact-checking-a-high-severity-claim) the skeptics run.

### D. Reconcile

Use for Phase 8, once every reviewed owner decision is settled. One `reconcile-<key>` unit per flow in a bounded pool, each a sequential pipeline; one integration step and one completeness critic after all flows.

```text
skip = reconcile-<key> units whose deliver stage is done, plus integrate and critic when done   // passed in on every rerun
pool(flows - skip, n, flow =>                  # units/reconcile-<key>.json; receipts/reconcile-<key>.json
  reconcile(flow)  -> proposal, wireframe, <key>-proposed.json, ticket draft; before and after screenshots
  review(flow)     -> two reviewers in parallel: (a) reference conformance and cross-artifact consistency,
                      (b) design language and rendering
  fix(flow)        -> apply valid issues, reject others with a reason; re-check blockers and majors only;
                      at most two rounds; unresolved issues travel with the delivery
  deliver(flow))   -> re-check the claim; commit the flow's files on the run branch, push the branch, update the
                      ticket body, comment with evidence and unresolved issues, restructure the tracker for this flow
integrate          -> one agent (units/integrate.json): re-check the claim; regenerate changed diagrams, update shared
                      files, run checks, rebase, land
critic             -> one agent (units/critic.json): each flow complete or its concrete gaps, plus process changes worth keeping
```

- **Workspace.** A dedicated worktree on a run branch; never edit or commit in the main checkout. Flow units share the worktree, so each touches only its flow's files (proposal, wireframe, `<key>-proposed.json`, `<key>-current.json` only when factually wrong, its ticket draft under `<state>/ux-flows/units/reconcile-<key>/`) and never stashes, resets, checks out other files or rebases. Generated diagram HTML and shared files (wireframe index, docs index, the reference's conformance section) belong to the integration step. Wireframe screenshots can use `file://` URLs from the worktree, because the stylesheet link is relative.
- **Reconcile.** Capture before screenshots; read the reference's sections 2 to 5, the flow's conformance entry, the common items and every decision-log entry naming the flow; apply every P and W item, then make the four artifacts agree with every applicable rule, not only the listed items. Record each change with its rule or entry ID in the checkpoint. Draft the ticket body in the unit directory; the tracker stays untouched until delivery. Capture after screenshots and fix layout problems.
- **Review.** Both reviewers are adversarial and edit nothing; they quote locations. Blocker: contradicts an approved decision or a rule's required behavior, or leaves the page misleading or broken. Major: a missing required item, a contradiction between the flow's artifacts, or a design-language violation. Minor: wording or an ID citation. They also list conventions the reference lacks that the flow needed, for the critic.
- **Deliver.** The one stage in the skill where a unit commits. First re-check that the run still holds the claim on its tracker item; if it does not, record that in the checkpoint and return without committing. Every step is idempotent through `receipts/reconcile-<key>.json`. Commit only the flow's files (`git commit -F <message file> -- <files>`, retrying while another agent holds the index lock), push the run branch so the work survives the machine, and record `committed`. A flow without a ticket gets one from its draft through the filer when tickets are in scope (otherwise the draft stays and the report lists it); record the number at once, then replace the placeholder links before committing. Update the ticket body from the draft and comment with the commit, the before and after screenshots and any unresolved issues. Restructure the tracker for this flow as [Filing](proposals-and-tickets.md#filing) describes.
- **Integrate.** The orchestrator's serial publish step for the run, and the only writer once the flows finish. First re-check the claim as Deliver does. Regenerate the diagrams whose specs changed on the run branch, one after another in one browser session, and verify each render. Update the shared files, with one line per flow in the reference's conformance section ("Reconciled in <commit>", or its unresolved issues). Run the project's checks, the wireframe linter and the crawl; commit; fetch and rebase on the default branch, resolving conflicts by keeping both sides, and re-run the checks; land through the project's integration workflow, retrying a rejected push after another rebase. Fast-forward the main checkout only when it is clean. Comment on the run's ticket with the landed revision, a per-flow table (flow, ticket, commit, unresolved issues) and the checks with durations.
- **Critic.** Checks every flow on the default branch: artifacts changed and diagrams regenerated, the wireframe passes the linter, the ticket body matches the proposal's criteria, covered findings and foundations are linked as Filing requires, priorities follow its rule. It reports each flow as complete or with concrete gaps, which become the next run's units.

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
  verify(ticket) from a clean state, own instance and session    # receipts/verify-<ticket>.json records each step
  -> one comment: confirmed, adjusted or not reproduced, with a recommended severity -> receipt)
```

## Sizing

- Run 8–12 heavy agents at once (an app instance with a browser, or a diagram render), counting every shape running concurrently. Measure memory headroom and per-instance cost first; never fan out unbounded.
- Log every coverage cut (a capped unit list, a dropped dimension, a skipped journey) in the run's output and in the owner report.
- Use one author for synthesis and revision so the result reads as one system. Parallelize only independent reads: reviews, audits, critiques, skeptics and verifiers.

## Services

- Start every service the units depend on (app instances, the backend, the docs server) outside the session's background tasks, which end at their time limits and with the session. Use an idempotent command that runs it detached or supervised: a terminal multiplexer, the OS service manager, or the dev runner's detached start that waits for readiness.
- Health-check each service before launch and again on resume: every allocated instance port and the backend must answer.
- Agents never start, stop or restart shared services. On an outage they record it in `environmentIssues`, stop the work that depends on it, and never report outage behavior as a product finding.
- Keep launch scripts, helpers and validators in durable project paths; a reboot wipes session temp. A reboot still kills every service, so resumable units are what survives it.

## Failures

- Catch each unit's failure as null (`{key, failed: stage}`) so one dead unit never kills the run; the run's return lists the failed units.
- Gates apply per unit. A unit that cannot pass its gate is `blocked` in its checkpoint, with `blocker` (the verified cause and its evidence) and `unblock` (the exact condition and next action). When an agent died without writing that, the orchestrating session marks the unit `failed` with the same fields after reading its termination record. Hold only the units that depend on it, continue the others, and list every blocked or failed unit in the report; the effort is not complete while one remains.
- Before naming why a unit died, read its own termination record: exit status, log tail, final transcript entries. Timing correlation is only a hypothesis; report verified causes separately from hypotheses. For example, in one harness a model request that hung about ten minutes was aborted by a watchdog and logged as interrupted by the user. Treat such a marker as a watchdog abort only when the termination record and the harness's documentation or logs confirm it; until then it is a hypothesis, and in another harness it may record a real user interrupt.
- An engine may restart an aborted agent from its prompt; its checkpoint carries it forward.
- After a provider outage or a reboot, health-check the services, compute the skip list and relaunch.
- Re-queue every unit that died without producing anything usable as a first-class unit of the next run, with its own key and budget, never folded into another unit's brief.
- Watch receipts while the run is going. When units stop delivering, diagnose immediately; a run that goes hours without a delivered unit is failing.

## Ownership

- Re-check the claim on the task's tracker item before every commit, push, release or ticket change (SKILL.md "Scope boundaries"): the orchestrator does, and so do shape D's deliver and integrate stages. If the run no longer holds it, record that in the checkpoint, save the work without committing, and report.
- When you hand claimed work to a background run, comment on the tracker item naming the run, where its journal and checkpoints live, and how to tell it is alive (for example the newest checkpoint's modification time, or the run's status command); an idle orchestrating session otherwise looks abandoned and can lose the claim.
- Units do not commit or push. They write only the paths their task names, with repository artifacts in a clean worktree; the orchestrator reviews them, moves scratch artifacts into the repository and publishes them serially through the project's Git workflow (shape B's publish step and each `committed` field). The one exception is shape D's deliver stage, which commits only its flow's files on the run branch and pushes that branch; the integrate step lands it. Filing and commenting through the helper are the only other external side effects a unit performs.

## Without parallel agents

- Run the same units one after another in risk order, with the same checkpoints, validators, receipts and per-unit delivery.
- Keep every barrier and its order: the pattern reference before any Phase 6 design, the cross-flow check before final delivery.
- Run verification, critique and fact-checks as separate passes after the producing pass, starting from a fresh read of the evidence (reopen the screenshots, reread the code and files), never from memory of producing it. Use a new session when one is available.
- One app instance and one browser session are enough; units still keep their own sandboxes and output files.
