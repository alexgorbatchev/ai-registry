import { describe, expect, it } from "bun:test";

import { formatSkillUsageReport } from "../formatSkillUsageReport";

const FIXTURE_SKILL_USAGE_REPORT = {
  overall: {
    label: "All projects",
    totalUsages: 5,
    averageUsagesPerDay: 1.67,
    distinctSkills: 3,
    usageDays: 3,
    skills: [
      { name: "bun", count: 3, averagePerDay: 1 },
      { name: "opencode-sessions", count: 1, averagePerDay: 0.33 },
      { name: "typescript", count: 1, averagePerDay: 0.33 },
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
        { name: "typescript", count: 1, averagePerDay: 0.5 },
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
};

describe("formatSkillUsageReport", () => {
  it("formats only the aggregate all-projects table by default", () => {
    const output = formatSkillUsageReport({
      report: FIXTURE_SKILL_USAGE_REPORT,
      showAllProjects: false,
    });

    expect(output).toMatchInlineSnapshot(`
"All projects
┌───────────────────┬────────┬─────────┐
│ Skill             │ Usages │ Avg/day │
├───────────────────┼────────┼─────────┤
│ bun               │      3 │    1.00 │
│ opencode-sessions │      1 │    0.33 │
│ typescript        │      1 │    0.33 │
├───────────────────┼────────┼─────────┤
│ Total             │      5 │    1.67 │
└───────────────────┴────────┴─────────┘
"
`);
  });

  it("formats only per-project tables when all-projects mode is requested", () => {
    const output = formatSkillUsageReport({
      report: FIXTURE_SKILL_USAGE_REPORT,
      showAllProjects: true,
    });

    expect(output).toMatchInlineSnapshot(`
"/repo-a
┌────────────┬────────┬─────────┐
│ Skill      │ Usages │ Avg/day │
├────────────┼────────┼─────────┤
│ bun        │      2 │    1.00 │
│ typescript │      1 │    0.50 │
├────────────┼────────┼─────────┤
│ Total      │      3 │    1.50 │
└────────────┴────────┴─────────┘

/repo-b
┌───────────────────┬────────┬─────────┐
│ Skill             │ Usages │ Avg/day │
├───────────────────┼────────┼─────────┤
│ bun               │      1 │    1.00 │
│ opencode-sessions │      1 │    1.00 │
├───────────────────┼────────┼─────────┤
│ Total             │      2 │    2.00 │
└───────────────────┴────────┴─────────┘
"
`);
  });
});
