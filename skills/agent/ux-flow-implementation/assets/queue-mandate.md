## Queue mandate

The owner authorized implementing {{THE_REDESIGNS_IN_SCOPE}} ({{DATE}}: "{{OWNER_WORDS}}"){{AND_AUTONOMY_THEY_GRANTED, FOR_EXAMPLE: and asked for full autonomy: agents decide ticket priority, order, dependencies and slicing from the evidence and never ask the owner to make bookkeeping decisions}}.

Execution of this queue is authorized. An agent working it:

1. Resumes owned unfinished slices first, then claims the next ready ticket in project `{{TRACKER_PROJECT}}` (`issue-tracker issue claim --next --project {{TRACKER_PROJECT}}`). {{OPEN_STOPGAPS_AND_PATCHES_THE_SLICES_DEPEND_ON}} are ordinary ready tickets and come first by priority.
2. Implements one slice per ticket from its redesign's proposal, wireframe and the shared pattern reference, which win over the slice text when they disagree.
3. Lands each slice on `{{TARGET_BRANCH}}`{{, RELEASING_SHARED_LIBRARY_CHANGES_FIRST}}; the orchestrator accepts each wave through a blind screenshot review, deploys it{{ TO_PRODUCTION}}, verifies the deployed behavior, and records the revision, checks and deployment on each slice ticket before closing it.
4. Closes a redesign ticket when all its slice tickets are closed and its acceptance criteria are verified in production; the findings it resolves close with it.
5. Files defects found outside a change as tickets in this epic in the same wave; tickets outside this mandate stay in the queue for other work.

Product decisions that the proposals and pattern reference do not settle go to the owner, asked the way the owner's instructions require; everything else is decided and recorded by the agent.

## Tickets

The redesign tickets ({{REDESIGN_TICKETS}}) carry the acceptance criteria and are blocked by their slice tickets. Each slice ticket names its proposal slice, its seams and the slices or tickets it waits for.
