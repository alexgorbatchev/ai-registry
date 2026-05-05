---
name: multica-agent-migration
description: Copy or migrate agents from one Multica workspace to another with the `multica` CLI. Use when asked to clone a workspace's agent lineup into a second workspace, inspect source and target agent sets, remap runtime/provider settings, handle duplicate agent names safely, or verify a migration completed correctly. Do not use for ordinary single-agent edits that stay inside one workspace.
author: alexgorbatchev
---

# Multica Agent Migration

Use this workflow when the goal is to recreate a set of agents in another workspace without guessing at runtimes or silently creating conflicts.

## Non-Negotiable Rules

- Use the `multica` CLI, not unsupported API calls or direct database-style workarounds.
- Treat `runtime_id` as workspace-scoped. Never reuse a source workspace runtime ID in the target workspace.
- Enumerate target runtimes before creating anything.
- Match runtimes by provider and exact runtime name first.
- If duplicate agent names already exist in the target, do not blindly create another copy.
- Verify the final target set against the source set after migration.

## Critical Warning: Runtime IDs Are Not Portable

Direct agent creation can fail with `invalid runtime_id` if you reuse the source workspace runtime ID in the target workspace.

This workflow is grounded in a successful migration where agents were copied from workspace `dev` to workspace `keeper`. Creation failed until the source Opencode runtime ID was replaced with the target workspace's valid Opencode runtime ID.

## Migration Workflow

### 1. Identify The Source And Target Workspaces

Start by confirming the current workspace and discovering the destination workspace ID.

```bash
multica workspace get --output json
multica workspace list
multica workspace get --output json --workspace-id <TARGET_WORKSPACE_ID>
```

Use `multica workspace list` to discover candidate workspaces, then `multica workspace get --output json` to confirm the exact source and target IDs you will use.

### 2. Inspect Source Agents And Existing Target Agents

Capture both sides before making changes.

```bash
multica agent list --output json --workspace-id <SOURCE_WORKSPACE_ID>
multica agent list --output json --workspace-id <TARGET_WORKSPACE_ID>
```

Use the source list as the migration input and the target list to detect duplicates, partial migrations, or already-migrated agents.

### 3. Enumerate Source And Target Runtimes

Do not guess runtime compatibility from agent data alone. Inspect the runtime catalogs directly.

```bash
multica runtime list --help
multica runtime list --output json --workspace-id <SOURCE_WORKSPACE_ID>
multica runtime list --output json --workspace-id <TARGET_WORKSPACE_ID>
```

For each source agent, resolve its source runtime object first, then map that runtime to a valid target runtime.

### 4. Choose The Target Runtime For Each Source Agent

Use this decision rule for every source agent:

1. Look up the source runtime object by the agent's `runtime_id` in the source runtime list.
2. Filter target runtimes to the same `provider`.
3. If exactly one target runtime has the same `provider` **and** exact `name`, use it.
4. Otherwise, if there is no exact name match but exactly one target runtime shares the same `provider`, use that runtime and state that you used a provider-only fallback.
5. Otherwise, stop and ask the user. Multiple provider matches without an exact name match are ambiguous.

Never copy the raw source `runtime_id` into the target create command.

### 5. Handle Duplicate Agent Names Safely

Before creating each agent, compare the source agent name against the target agent list.

- If no target agent has that name, create it.
- If a target agent with the same name already exists and its `description`, `instructions`, `model`, `max_concurrent_tasks`, and `visibility` already match the source agent, treat it as already migrated and skip creation.
- If a target agent with the same name exists but any of those fields differ, stop and ask the user whether to skip, update, replace, or rename. Do not guess.

This avoids two bad outcomes: accidental duplicate agents and silent mutation of an agent the user did not mean to overwrite.

### 6. Create Missing Agents With The Target Runtime ID

Use the mapped target runtime ID, not the source runtime ID.

```bash
multica agent create --workspace-id <TARGET_WORKSPACE_ID> --output json --name <name> --description <description> --instructions <instructions> --max-concurrent-tasks <n> --model <model> --runtime-id <TARGET_RUNTIME_ID> --visibility <visibility>
```

Repeat this for each source agent that is not already present in the target workspace.

### 7. Verify The Migration

Re-list both workspaces and compare the resulting agent sets.

```bash
multica agent list --output json --workspace-id <TARGET_WORKSPACE_ID>
multica agent list --output json --workspace-id <SOURCE_WORKSPACE_ID>
```

Verification must confirm that every migrated target agent matches its source agent on:

- `name`
- `description`
- `instructions`
- `model`
- `max_concurrent_tasks`
- `visibility`

Allow `runtime_id` values to differ. They should differ whenever the workspaces use different runtime records.

Also confirm that each target agent's runtime ID belongs to the target workspace runtime list and that the provider mapping you chose is still valid.

## Full Command Sequence

Use this sequence when performing the migration end to end:

```bash
multica workspace get --output json
multica agent list --output json
multica agent --help
multica --help
multica agent create --help
multica workspace --help
multica workspace list
multica workspace get --output json --workspace-id <TARGET_WORKSPACE_ID>
multica agent list --output json --workspace-id <TARGET_WORKSPACE_ID>
multica runtime list --help
multica runtime list --workspace-id <TARGET_WORKSPACE_ID>
multica runtime list --output json --workspace-id <SOURCE_WORKSPACE_ID>
multica runtime list --output json --workspace-id <TARGET_WORKSPACE_ID>
multica agent create --workspace-id <TARGET_WORKSPACE_ID> --output json --name <name> --description <description> --instructions <instructions> --max-concurrent-tasks <n> --model <model> --runtime-id <TARGET_RUNTIME_ID> --visibility <visibility>
multica agent list --output json --workspace-id <TARGET_WORKSPACE_ID>
multica agent list --output json --workspace-id <SOURCE_WORKSPACE_ID>
```

This is intentionally explicit. The important lesson from the successful migration is that runtime enumeration and remapping are required steps, not optional cleanup.

## Failure Handling

- **`invalid runtime_id` on create**: Stop, inspect target runtimes again, and remap the source runtime by provider and name. This error is evidence that the source runtime ID is not valid in the target workspace.
- **Duplicate agent name in target**: Do not create a second copy blindly. Compare fields and either skip an already-matching agent or ask the user how to resolve the conflict.
- **No target runtime with matching provider**: Stop and tell the user the target workspace lacks a compatible runtime.
- **Multiple target runtimes share the provider with no exact name match**: Stop and ask the user which runtime should receive migrated agents.
- **Partial migration**: Re-run target agent listing, compare against the source set, and create only the remaining missing agents after resolving runtime mapping and duplicate-name questions.

## Completion Checklist

Before declaring success, confirm all of the following:

1. Source and target workspace IDs were verified explicitly.
2. Source agents were listed before creation began.
3. Target agents were listed before creation began.
4. Source and target runtimes were listed explicitly.
5. Every created agent used a runtime ID that belongs to the target workspace.
6. Every source agent now has exactly one matching target agent, unless the user explicitly chose a different duplicate-handling outcome.
7. Name, description, instructions, model, max concurrency, and visibility match between source and target.
8. Any provider-only runtime fallback was called out explicitly in the final report.
