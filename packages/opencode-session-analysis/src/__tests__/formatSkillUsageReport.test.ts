import { describe, expect, it } from "bun:test";

import { formatSkillUsageReport } from "../formatSkillUsageReport";

const FIXTURE_SKILL_USAGE_REPORT = {
  overall: {
    label: "All projects",
    totalUsages: 5,
    distinctSkills: 3,
    skills: [
      { name: "bun", count: 3 },
      { name: "opencode-sessions", count: 1 },
      { name: "typescript-code-quality", count: 1 },
    ],
  },
  byProject: [
    {
      label: "/repo-a",
      totalUsages: 3,
      distinctSkills: 2,
      skills: [
        { name: "bun", count: 2 },
        { name: "typescript-code-quality", count: 1 },
      ],
    },
    {
      label: "/repo-b",
      totalUsages: 2,
      distinctSkills: 2,
      skills: [
        { name: "bun", count: 1 },
        { name: "opencode-sessions", count: 1 },
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
┌─────────────────────────┬────────┐
│ Skill                   │ Usages │
├─────────────────────────┼────────┤
│ bun                     │      3 │
├─────────────────────────┼────────┤
│ opencode-sessions       │      1 │
├─────────────────────────┼────────┤
│ typescript-code-quality │      1 │
├─────────────────────────┼────────┤
│ Total                   │      5 │
└─────────────────────────┴────────┘
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
┌─────────────────────────┬────────┐
│ Skill                   │ Usages │
├─────────────────────────┼────────┤
│ bun                     │      2 │
├─────────────────────────┼────────┤
│ typescript-code-quality │      1 │
├─────────────────────────┼────────┤
│ Total                   │      3 │
└─────────────────────────┴────────┘

/repo-b
┌───────────────────┬────────┐
│ Skill             │ Usages │
├───────────────────┼────────┤
│ bun               │      1 │
├───────────────────┼────────┤
│ opencode-sessions │      1 │
├───────────────────┼────────┤
│ Total             │      2 │
└───────────────────┴────────┘
"
`);
  });
});
