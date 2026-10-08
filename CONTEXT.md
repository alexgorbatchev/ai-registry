---
created_on: 2026-10-07 14:55
last_modified: 2026-10-07 17:11
status: current
---

# AI Registry

Shared terminology for the registry's reusable skills and workflows.

## Language

**GitHub issue workflow**:
The workflow provided by the `github-fix-issues` skill, encompassing issue creation, implementation through review and merge, post-merge cleanup, and repair of historical issue-integration merges.
_Avoid_: Using "issue workflow" to mean implementation alone.

**Implementing agent**:
The single agent responsible for making changes, executing repository checks, and supplying their recorded evidence. While a PR is under review, it works on the next eligible independent ticket and returns to pending reviews at scheduling checkpoints.
_Avoid_: Treating the implementing agent as a coordinator that delegates implementation to other agents.

**Review agent**:
The independent agent that reviews the proposed diff and the implementing agent's check evidence without executing repository checks itself. Inspection and communication tools remain available to this agent.
_Avoid_: Interpreting "no checks" as a prohibition on all tooling.

**Issue queue**:
The tickets selected for issue work, ordered oldest first with prerequisite tickets placed before their dependents. The queue preserves resolved dependencies and ordering across restarts.
_Avoid_: Age-only ordering that ignores prerequisites.

**Pending review**:
A submitted PR round awaiting its reviewer's response. It releases the implementing agent to other eligible work while preserving the reviewed branch and its evidence.
_Avoid_: Treating review handoff as a requirement to idle or as completion of the ticket.

**Check evidence**:
The recorded output and results of repository checks supplied by the implementing agent for review. This evidence remains available on the pull request after sign-off.
_Avoid_: Treating a pass/fail claim without recorded output as the check evidence.

**Review sign-off**:
The review agent's native GitHub approval of the pull request after no findings remain. Findings requiring revision are submitted using GitHub's native request-changes review outcome.
_Avoid_: Substituting an approval-like comment for a native review decision.

**Reviewer identity**:
The GitHub bot account through which the review agent posts feedback and native review decisions, distinct from the account that authors the pull request.
_Avoid_: Treating separate agent sessions as separate GitHub identities.

**Blocked ticket**:
A ticket that cannot currently proceed because required information, access, or prerequisite work is unavailable. It remains in the issue queue until its blocker is resolved.
_Avoid_: Treating blocked work as completed or dropping it from the queue.

**Historical issue-integration repair**:
An explicitly requested recovery operation that removes selected merge commits left by prior issue work while preserving the file tree and non-merge changes. It is distinct from normal ticket integration and post-merge artifact cleanup.
_Avoid_: Treating routine branch and worktree cleanup as authorization to rewrite published history.

**Baseline repair**:
Work that corrects failures of required repository checks already present before the selected ticket's changes. It is tracked as prerequisite ticket work and is required for the affected issue work to proceed.
_Avoid_: Treating a new regression as a pre-existing failure.
