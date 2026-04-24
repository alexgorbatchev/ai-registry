import { describe, expect, it } from "bun:test";

import { createSkillUsageReport } from "../createSkillUsageReport";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

describe("createSkillUsageReport", () => {
  it("aggregates overall and per-project skill usage for git worktrees", () => {
    const report = createSkillUsageReport({
      sessions: [
        { id: "root-a", directory: "/repo-a", project_worktree: "/repo-a" },
        { id: "sub-a", directory: "/repo-a", project_worktree: "/repo-a" },
        { id: "root-b", directory: "/repo-b", project_worktree: "/repo-b" },
      ],
      toolParts: [
        {
          session_id: "root-a",
          time_created: DAY_IN_MILLISECONDS,
          data: JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "bun" } } }),
        },
        {
          session_id: "root-a",
          time_created: 2 * DAY_IN_MILLISECONDS,
          data: JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "bun" } } }),
        },
        {
          session_id: "sub-a",
          time_created: 2 * DAY_IN_MILLISECONDS,
          data: JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "typescript-code-quality" } } }),
        },
        {
          session_id: "root-b",
          time_created: 3 * DAY_IN_MILLISECONDS,
          data: JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "bun" } } }),
        },
        {
          session_id: "root-b",
          time_created: 3 * DAY_IN_MILLISECONDS,
          data: JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "opencode-sessions" } } }),
        },
        {
          session_id: "root-b",
          time_created: 3 * DAY_IN_MILLISECONDS,
          data: JSON.stringify({ type: "tool", tool: "bash", state: { input: { command: "git status" } } }),
        },
      ],
    });

    expect(report).toEqual({
      overall: {
        label: "All projects",
        totalUsages: 5,
        averageUsagesPerDay: 5 / 3,
        distinctSkills: 3,
        usageDays: 3,
        skills: [
          { name: "bun", count: 3, averagePerDay: 1 },
          { name: "opencode-sessions", count: 1, averagePerDay: 1 / 3 },
          { name: "typescript-code-quality", count: 1, averagePerDay: 1 / 3 },
        ],
      },
      byProject: [
        {
          label: "/repo-a",
          totalUsages: 3,
          averageUsagesPerDay: 1.5,
          distinctSkills: 2,
          usageDays: 2,
          skills: [
            { name: "bun", count: 2, averagePerDay: 1 },
            { name: "typescript-code-quality", count: 1, averagePerDay: 0.5 },
          ],
        },
        {
          label: "/repo-b",
          totalUsages: 2,
          averageUsagesPerDay: 2,
          distinctSkills: 2,
          usageDays: 1,
          skills: [
            { name: "bun", count: 1, averagePerDay: 1 },
            { name: "opencode-sessions", count: 1, averagePerDay: 1 },
          ],
        },
      ],
    });
  });

  it("treats global directories as separate scopes and ignores malformed skill records", () => {
    const report = createSkillUsageReport({
      sessions: [
        { id: "global-a", directory: "/scratch/a", project_worktree: "/" },
        { id: "global-b", directory: "/scratch/b", project_worktree: "/" },
      ],
      toolParts: [
        {
          session_id: "global-a",
          time_created: DAY_IN_MILLISECONDS,
          data: JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "readme-writer" } } }),
        },
        {
          session_id: "global-a",
          time_created: DAY_IN_MILLISECONDS,
          data: JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "readme-writer" } } }),
        },
        {
          session_id: "global-b",
          time_created: 3 * DAY_IN_MILLISECONDS,
          data: JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "bun" } } }),
        },
        {
          session_id: "global-b",
          time_created: 3 * DAY_IN_MILLISECONDS,
          data: JSON.stringify({ type: "tool", tool: "skill", state: { input: { title: "missing-name" } } }),
        },
        {
          session_id: "does-not-exist",
          time_created: 3 * DAY_IN_MILLISECONDS,
          data: JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "ignored" } } }),
        },
        { session_id: "global-b", time_created: 3 * DAY_IN_MILLISECONDS, data: "not-json" },
      ],
    });

    expect(report).toEqual({
        overall: {
          label: "All projects",
          totalUsages: 3,
          averageUsagesPerDay: 1,
          distinctSkills: 2,
          usageDays: 3,
          skills: [
          { name: "readme-writer", count: 2, averagePerDay: 2 / 3 },
          { name: "bun", count: 1, averagePerDay: 1 / 3 },
          ],
        },
      byProject: [
        {
          label: "/scratch/a",
          totalUsages: 2,
          averageUsagesPerDay: 2,
          distinctSkills: 1,
          usageDays: 1,
          skills: [{ name: "readme-writer", count: 2, averagePerDay: 2 }],
        },
        {
          label: "/scratch/b",
          totalUsages: 1,
          averageUsagesPerDay: 1,
          distinctSkills: 1,
          usageDays: 1,
          skills: [{ name: "bun", count: 1, averagePerDay: 1 }],
        },
      ],
    });
  });
});
