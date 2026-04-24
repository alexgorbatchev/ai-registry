import { resolve } from "node:path";

interface ISkillUsageSession {
  id: string;
  directory: string;
  project_worktree: string;
}

interface ISkillUsagePart {
  session_id: string;
  time_created: number;
  data: string;
}

interface ICreateSkillUsageReportArgs {
  sessions: readonly ISkillUsageSession[];
  toolParts: readonly ISkillUsagePart[];
}

export interface ISkillUsageCountEntry {
  name: string;
  count: number;
  averagePerDay: number;
}

export interface ISkillUsageSection {
  label: string;
  totalUsages: number;
  averageUsagesPerDay: number;
  distinctSkills: number;
  usageDays: number;
  skills: ISkillUsageCountEntry[];
}

export interface ISkillUsageReport {
  overall: ISkillUsageSection;
  byProject: ISkillUsageSection[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function getPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

function getStringPath(value: unknown, path: string[]): string | undefined {
  const result = getPath(value, path);
  return typeof result === "string" ? result : undefined;
}

function incrementCount(map: Map<string, number>, name: string): void {
  map.set(name, (map.get(name) ?? 0) + 1);
}

function sortCounts(map: Map<string, number>): ISkillUsageCountEntry[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count, averagePerDay: 0 }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function getUsageDays(firstUsageAt: number | undefined, lastUsageAt: number | undefined): number {
  if (firstUsageAt === undefined || lastUsageAt === undefined) {
    return 0;
  }

  const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((lastUsageAt - firstUsageAt + 1) / MILLISECONDS_PER_DAY));
}

function getSessionProjectLabel(session: ISkillUsageSession): string {
  if (session.project_worktree !== "/") {
    return session.project_worktree;
  }

  return resolve(session.directory);
}

function buildSection(
  label: string,
  counts: Map<string, number>,
  firstUsageAt: number | undefined,
  lastUsageAt: number | undefined,
): ISkillUsageSection {
  const skills = sortCounts(counts);
  const totalUsages = skills.reduce((total, skill) => total + skill.count, 0);
  const usageDays = getUsageDays(firstUsageAt, lastUsageAt);
  const averageUsagesPerDay = usageDays > 0 ? totalUsages / usageDays : 0;

  return {
    label,
    totalUsages,
    averageUsagesPerDay,
    distinctSkills: skills.length,
    usageDays,
    skills: skills.map((skill) => ({
      ...skill,
      averagePerDay: usageDays > 0 ? skill.count / usageDays : 0,
    })),
  };
}

export function createSkillUsageReport(args: ICreateSkillUsageReportArgs): ISkillUsageReport {
  const sessionById = new Map(args.sessions.map((session) => [session.id, session]));
  const overallCounts = new Map<string, number>();
  const projectCountsByLabel = new Map<string, Map<string, number>>();
  let overallFirstUsageAt: number | undefined;
  let overallLastUsageAt: number | undefined;
  const projectFirstUsageAtByLabel = new Map<string, number>();
  const projectLastUsageAtByLabel = new Map<string, number>();

  for (const part of args.toolParts) {
    const session = sessionById.get(part.session_id);
    if (!session) {
      continue;
    }

    const partData = parseJson(part.data);
    const toolName = getStringPath(partData, ["tool"]);
    if (toolName !== "skill") {
      continue;
    }

    const skillName = getStringPath(partData, ["state", "input", "name"]);
    if (!skillName) {
      continue;
    }

    incrementCount(overallCounts, skillName);
    overallFirstUsageAt = overallFirstUsageAt === undefined ? part.time_created : Math.min(overallFirstUsageAt, part.time_created);
    overallLastUsageAt = overallLastUsageAt === undefined ? part.time_created : Math.max(overallLastUsageAt, part.time_created);

    const projectLabel = getSessionProjectLabel(session);
    const projectCounts = projectCountsByLabel.get(projectLabel) ?? new Map<string, number>();
    incrementCount(projectCounts, skillName);
    projectCountsByLabel.set(projectLabel, projectCounts);
    projectFirstUsageAtByLabel.set(
      projectLabel,
      Math.min(projectFirstUsageAtByLabel.get(projectLabel) ?? part.time_created, part.time_created),
    );
    projectLastUsageAtByLabel.set(
      projectLabel,
      Math.max(projectLastUsageAtByLabel.get(projectLabel) ?? part.time_created, part.time_created),
    );
  }

  const byProject = [...projectCountsByLabel.entries()]
    .map(([label, counts]) =>
      buildSection(label, counts, projectFirstUsageAtByLabel.get(label), projectLastUsageAtByLabel.get(label)),
    )
    .sort((left, right) => right.totalUsages - left.totalUsages || left.label.localeCompare(right.label));

  return {
    overall: buildSection("All projects", overallCounts, overallFirstUsageAt, overallLastUsageAt),
    byProject,
  };
}
