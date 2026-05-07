---
name: multica-ticket-creation
description: Create Multica issues with correct routing, project selection, and issue metadata using the `multica` CLI. Use when asked to open a ticket, file an issue, or turn work into a tracked Multica task. Distinguish workspace-wide tickets from project-specific tickets, require `--project` for project-specific work every time, and stop to ask for clarification instead of guessing when the request is project-scoped but no project is identified.
author: alexgorbatchev
---

# Multica Ticket Creation

Use this workflow to create Multica tickets without misrouting work.

The critical rule is simple: if the ticket belongs to one specific project, include `--project <project-id>` on creation every time. If the request is project-specific but the project is missing or ambiguous, stop and ask; never guess.

## Non-Negotiable Rules

- Use the `multica` CLI for all reads and writes.
- Use `--output json` on read commands so project IDs and issue IDs are exact.
- Treat project routing as required data, not optional cleanup.
- Include `--project <project-id>` on every project-specific ticket.
- Omit `--project` only for genuinely workspace-wide tickets.
- If the request is project-specific but no project is provided, ask a clarification question before creating anything.
- If multiple projects could match, ask the user which one they want. Do not infer from partial name overlap.
- Prefer `--description-stdin` for multi-line descriptions so formatting survives intact.

## Decide Whether The Ticket Is Project-Specific

Classify the request before drafting the command.

### Project-Specific

- The request targets one repo, app, service, package, or delivery stream.
- The bug, feature, docs change, or task belongs to one named project.
- The user references one project resource such as a repository URL, codebase path, branch, or release stream.
- Completing the work would naturally be owned by one project board.

Examples: "Create a ticket for the payment service retry bug", "File this against the mobile app", "Open a task for repo https://example.com/org/api".

### Workspace-Wide

- The request is about workspace policy, shared process, labels, agent behavior, triage rules, or reporting across projects.
- The work is not owned by one project, or it intentionally spans the whole workspace.
- The correct ticket should live outside any single project backlog.

Examples: "Create a ticket to standardize issue labels across the workspace", "Open a task for improving agent handoff rules", "Track workspace onboarding docs cleanup".

### Ambiguous Or Missing Project

Treat the request as incomplete and ask a follow-up when any of these are true:

- The task sounds scoped to a product or repo, but no project name or resource is given.
- More than one existing project could plausibly own the work.
- The user describes a feature area that does not map cleanly to a known project.

Use a direct clarification such as: `This sounds project-specific. Which Multica project should I attach it to? I should not guess the project.`

## Ticket Creation Workflow

### 1. Inspect The Workspace And Projects

Start by discovering the available projects and their IDs.

```bash
multica workspace get --output json
multica project list --output json
```

If the request references a repo or you need to confirm ownership, inspect project resources too.

```bash
multica project resource list <project-id> --output json
```

Use those results to map repository URLs or other resources to the correct project. If no project clearly matches and the work still appears project-specific, ask instead of creating the ticket.

### 2. Decide The Routing Before Drafting The Command

Apply the decision rule explicitly:

1. If one project clearly owns the work, mark the ticket as project-specific and capture that project's ID.
2. If the work is clearly workspace-wide, proceed without `--project`.
3. If the work is project-specific but the project is missing or ambiguous, stop and ask.

### 3. Draft The Issue Content

Prepare:

- a concise title
- a clear description grounded in the user's request
- optional priority, assignee, parent issue, or due date when the user supplied them

For multi-line descriptions, use stdin instead of inline escaping.

### 4. Create The Ticket With The Correct Command Shape

#### Project-Specific Ticket

```bash
cat <<'DESCRIPTION' | multica issue create \
  --title "Investigate payment retry failures" \
  --project <project-id> \
  --priority medium \
  --description-stdin
Retry requests are failing after the third attempt.
Capture the failure mode, expected behavior, and proposed fix scope.
DESCRIPTION
```

#### Workspace-Wide Ticket

```bash
cat <<'DESCRIPTION' | multica issue create \
  --title "Standardize workspace issue labels" \
  --priority medium \
  --description-stdin
Audit current labels, identify overlaps, and propose a single workspace-wide label set.
DESCRIPTION
```

The only routing difference is intentional: project-specific tickets include `--project`; workspace-wide tickets do not.

### 5. Verify The Result

After creation, confirm the returned issue record has the expected title and routing:

- project-specific ticket: `project_id` is populated with the chosen project
- workspace-wide ticket: `project_id` is empty or null

If the created ticket lands in the wrong scope, report the mistake immediately instead of silently continuing.

## Concrete Examples

### Example: Correct Project-Specific Behavior

User request: `Create a Multica ticket for the docs-service repo to add encrypted export support.`

Correct behavior:

1. Run `multica project list --output json`.
2. Run `multica project resource list <project-id> --output json` until the repo ownership is confirmed.
3. Create the issue with `--project <docs-service-project-id>`.

Why: the work is attached to one repository, so it is project-specific.

### Example: Correct Workspace-Wide Behavior

User request: `Open a ticket to document our workspace triage policy.`

Correct behavior:

1. Recognize that this is a workspace process task, not a single project backlog item.
2. Create the issue without `--project`.

Why: the work applies across the workspace rather than to one project.

### Example: Required Clarification

User request: `Create a ticket for the release checklist updates.`

Correct behavior:

1. Notice that this could belong to a specific project release workflow.
2. If the owning project is not stated and cannot be confirmed from context, ask which project should own it.
3. Do not create the ticket until that answer is available.

Why: the request sounds project-scoped, and guessing would misroute the issue.

## Final Checklist

Before finishing, confirm all of the following:

1. You classified the request as project-specific or workspace-wide.
2. Every project-specific ticket includes `--project <project-id>`.
3. No project was guessed when the request was incomplete or ambiguous.
4. The title and description reflect the user's request accurately.
5. The created issue's `project_id` matches the intended routing.
