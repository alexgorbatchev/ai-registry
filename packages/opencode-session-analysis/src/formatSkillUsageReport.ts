import { getBorderCharacters, table } from "table";

import type { ISkillUsageReport, ISkillUsageSection } from "./createSkillUsageReport";

interface IFormatSkillUsageReportArgs {
  report: ISkillUsageReport;
  showAllProjects: boolean;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatSkillUsageTable(section: ISkillUsageSection): string {
  const rows = [
    ["Skill", "Usages"],
    ...section.skills.map((skill) => [skill.name, formatInteger(skill.count)]),
    ["Total", formatInteger(section.totalUsages)],
  ];

  return table(rows, {
    border: getBorderCharacters("norc"),
    columns: {
      1: { alignment: "right" },
    },
  });
}

function formatSkillUsageSection(section: ISkillUsageSection): string {
  if (section.skills.length === 0) {
    return `${section.label}\nNo skill usage found.\n`;
  }

  return `${section.label}\n${formatSkillUsageTable(section)}`;
}

export function formatSkillUsageReport(args: IFormatSkillUsageReportArgs): string {
  if (args.showAllProjects) {
    if (args.report.byProject.length === 0) {
      return "No skill usage found in any project.\n";
    }

    return args.report.byProject.map((section) => formatSkillUsageSection(section)).join("\n");
  }

  return formatSkillUsageSection(args.report.overall);
}
