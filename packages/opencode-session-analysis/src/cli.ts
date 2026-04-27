#!/usr/bin/env bun

import { cancel, confirm, isCancel, multiselect } from "@clack/prompts";
import { createSkillUsageReport } from "./createSkillUsageReport";
import { formatSkillUsageReport } from "./formatSkillUsageReport";
import { readSyncableSkillSources } from "./readSyncableSkillSources";
import { syncProjectSkills } from "./syncProjectSkills";
import { Database } from "bun:sqlite";
import { Command } from "commander";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { getBorderCharacters, table } from "table";

interface ISkillsCommandOptions {
  all?: boolean;
  sync?: boolean;
  pick?: boolean;
  registryDir?: string;
  yes?: boolean;
}

interface ISessionsCommandOptions {
  all?: boolean;
  sessionId?: string;
}

interface ISessionRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  slug: string;
  directory: string;
  title: string;
  time_created: number;
  time_updated: number;
  time_archived: number | null;
  project_worktree: string;
}

interface IMessageRow {
  session_id: string;
  time_created: number;
  time_updated: number;
  data: string;
}

interface IPartRow {
  session_id: string;
  time_created: number;
  time_updated: number;
  data: string;
}

interface IProjectResolution {
  directory: string;
  worktree: string;
  sandbox: string;
  isGlobal: boolean;
}

interface ITokenTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  reasoning: number;
}

interface ICountEntry {
  name: string;
  count: number;
}

interface ISessionReport {
  root: ISessionRow;
  totalSessions: number;
  subagentSessions: number;
  toolCalls: number;
  startedAt: number;
  updatedAt: number;
  elapsedDurationMs: number;
  activeDurationMs: number;
  outputTokensPerSecond: number;
  tokens: ITokenTotals;
  cost: number;
  models: ICountEntry[];
  tools: ICountEntry[];
  mcpServers: ICountEntry[];
}

type JsonRecord = Record<string, unknown>;

interface ITimeInterval {
  start: number;
  end: number;
}

const DATA_DIR = join(process.env.XDG_DATA_HOME ?? join(process.env.HOME ?? "", ".local", "share"), "opencode");
const DB_PATH = join(DATA_DIR, "opencode.db");
const LEGACY_STORAGE_DIR = join(DATA_DIR, "storage");
const DEFAULT_IDLE_GAP_MS = 5 * 60 * 1000;
const DEFAULT_IDLE_GAP_LABEL = "5m";
const COMMAND_NAME = process.env.OPENCODE_SESSION_ANALYSIS_COMMAND?.trim() || "opencode-session-analysis";
const REGISTRY_DIR_ENV = "OPENCODE_SESSION_ANALYSIS_REGISTRY_DIR";
const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

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

function getNumberPath(value: unknown, path: string[]): number | undefined {
  const result = getPath(value, path);
  return typeof result === "number" && Number.isFinite(result) ? result : undefined;
}

function incrementCount(map: Map<string, number>, name: string): void {
  map.set(name, (map.get(name) ?? 0) + 1);
}

function sortCounts(map: Map<string, number>): ICountEntry[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function formatTimestamp(timestamp: number): string {
  return TIMESTAMP_FORMATTER.format(new Date(timestamp));
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (hours > 0 || minutes > 0) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

function formatActiveSummaryDuration(durationMs: number): string {
  if (durationMs <= 0) {
    return "0m";
  }

  const totalMinutes = Math.max(1, Math.ceil(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (hours > 0 || minutes > 0) {
    parts.push(`${minutes}m`);
  }

  return parts.join(" ");
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRate(value: number): string {
  return Number.isFinite(value) ? formatDecimal(value) : "0.00";
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatCountList(entries: ICountEntry[]): string {
  return entries.length > 0 ? entries.map((entry) => `${entry.name}=${entry.count}`).join(", ") : "none";
}

function createInterval(start: number, end: number): ITimeInterval {
  if (end < start) {
    return { start, end: start };
  }
  return { start, end };
}

function sumMergedIntervals(intervals: ITimeInterval[], idleGapMs: number): number {
  if (intervals.length === 0) {
    return 0;
  }

  const sortedIntervals = [...intervals].sort((left, right) => left.start - right.start || left.end - right.end);
  let mergedStart = sortedIntervals[0]?.start ?? 0;
  let mergedEnd = sortedIntervals[0]?.end ?? 0;
  let totalDurationMs = 0;

  for (const interval of sortedIntervals.slice(1)) {
    if (interval.start - mergedEnd <= idleGapMs) {
      mergedEnd = Math.max(mergedEnd, interval.end);
      continue;
    }

    totalDurationMs += Math.max(0, mergedEnd - mergedStart);
    mergedStart = interval.start;
    mergedEnd = interval.end;
  }

  totalDurationMs += Math.max(0, mergedEnd - mergedStart);
  return totalDurationMs;
}

function findGitDirectory(startDirectory: string): string | undefined {
  let currentDirectory = resolve(startDirectory);

  while (true) {
    const dotGitPath = join(currentDirectory, ".git");
    if (existsSync(dotGitPath)) {
      return dotGitPath;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return undefined;
    }
    currentDirectory = parentDirectory;
  }
}

function runGit(args: string[], cwd: string): { success: boolean; output: string } {
  if (!Bun.which("git")) {
    return { success: false, output: "" };
  }

  try {
    const result = Bun.spawnSync({
      cmd: ["git", ...args],
      cwd,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    return { success: result.exitCode === 0, output: result.stdout.toString().trim() };
  } catch {
    return { success: false, output: "" };
  }
}

function resolveGitPath(cwd: string, gitPath: string): string {
  const cleanPath = gitPath.replace(/[\r\n]+$/g, "");
  if (cleanPath.length === 0) {
    return cwd;
  }
  return resolve(cwd, cleanPath);
}

function resolveProject(directory: string): IProjectResolution {
  const dotGitPath = findGitDirectory(directory);
  if (!dotGitPath) {
    return {
      directory,
      worktree: "/",
      sandbox: "/",
      isGlobal: true,
    };
  }

  const sandboxDirectory = dirname(dotGitPath);
  const commonDirectoryResult = runGit(["rev-parse", "--git-common-dir"], sandboxDirectory);
  if (!commonDirectoryResult.success) {
    return {
      directory,
      worktree: sandboxDirectory,
      sandbox: sandboxDirectory,
      isGlobal: false,
    };
  }

  const commonDirectory = resolveGitPath(sandboxDirectory, commonDirectoryResult.output);
  const worktree = commonDirectory === sandboxDirectory ? sandboxDirectory : dirname(commonDirectory);
  const topLevelResult = runGit(["rev-parse", "--show-toplevel"], sandboxDirectory);
  const sandbox = topLevelResult.success ? resolveGitPath(sandboxDirectory, topLevelResult.output) : sandboxDirectory;

  return {
    directory,
    worktree,
    sandbox,
    isGlobal: false,
  };
}

function looksLikeRegistryRoot(directoryPath: string): boolean {
  return (
    existsSync(join(directoryPath, "skills")) &&
    existsSync(join(directoryPath, "harnesses", "opencode", "skills"))
  );
}

function findRegistryRoot(startDirectory: string): string | undefined {
  let currentDirectory = resolve(startDirectory);

  while (true) {
    if (looksLikeRegistryRoot(currentDirectory)) {
      return currentDirectory;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
}

function resolveRegistryRoot(registryDirOption: string | undefined): string {
  const configuredRegistryDir = registryDirOption?.trim() || process.env[REGISTRY_DIR_ENV]?.trim();
  if (configuredRegistryDir) {
    const resolvedRegistryDir = resolve(configuredRegistryDir);
    if (!looksLikeRegistryRoot(resolvedRegistryDir)) {
      throw new Error(`Registry directory does not look like an ai-registry checkout: ${resolvedRegistryDir}`);
    }

    return resolvedRegistryDir;
  }

  const detectedRegistryDir = findRegistryRoot(import.meta.dir);
  if (detectedRegistryDir) {
    return detectedRegistryDir;
  }

  throw new Error(
    `Could not detect an ai-registry checkout automatically. Re-run with --registry-dir <path> or set ${REGISTRY_DIR_ENV}.`,
  );
}

function getProjectRootPath(resolution: IProjectResolution): string {
  return resolution.isGlobal ? resolution.directory : resolution.sandbox;
}

function getInteractiveSelectionErrorMessage(): string {
  return "Skill sync cancelled.";
}

async function promptForSkillSelection(args: {
  initialValues: readonly string[];
  options: readonly { disabled: boolean; hint?: string; label: string; value: string }[];
}): Promise<readonly string[]> {
  const selection = await multiselect({
    message: "Select used skills to sync into .opencode/skills",
    options: [...args.options],
    initialValues: [...args.initialValues],
    required: false,
  });

  if (isCancel(selection)) {
    cancel(getInteractiveSelectionErrorMessage());
    throw new Error(getInteractiveSelectionErrorMessage());
  }

  return selection;
}

async function promptToConfirmOverwrite(message: string): Promise<boolean> {
  const shouldOverwrite = await confirm({
    initialValue: false,
    message,
  });

  if (isCancel(shouldOverwrite)) {
    cancel(getInteractiveSelectionErrorMessage());
    throw new Error(getInteractiveSelectionErrorMessage());
  }

  return shouldOverwrite;
}

function getPrimaryModelLabel(entries: ICountEntry[]): string {
  if (entries.length === 0) {
    return "unknown";
  }
  return entries[0].name;
}

function readSessions(database: Database): ISessionRow[] {
  return database
    .query<ISessionRow, []>(
      `
        SELECT
          s.id,
          s.project_id,
          s.parent_id,
          s.slug,
          s.directory,
          s.title,
          s.time_created,
          s.time_updated,
          s.time_archived,
          p.worktree AS project_worktree
        FROM session s
        JOIN project p ON p.id = s.project_id
        ORDER BY s.time_updated DESC
      `,
    )
    .all();
}

function readAssistantMessages(database: Database): IMessageRow[] {
  return database
    .query<IMessageRow, []>(
      `
        SELECT session_id, time_created, time_updated, data
        FROM message
        WHERE json_extract(data, '$.role') = 'assistant'
        ORDER BY time_created DESC
      `,
    )
    .all();
}

function readToolParts(database: Database): IPartRow[] {
  return database
    .query<IPartRow, []>(
      `
        SELECT session_id, time_created, time_updated, data
        FROM part
        WHERE json_extract(data, '$.type') = 'tool'
        ORDER BY time_created DESC
      `,
    )
    .all();
}

function buildChildrenMap(sessions: ISessionRow[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const session of sessions) {
    if (!session.parent_id) {
      continue;
    }
    const currentChildren = children.get(session.parent_id) ?? [];
    currentChildren.push(session.id);
    children.set(session.parent_id, currentChildren);
  }
  return children;
}

function matchesProjectResolution(session: ISessionRow, resolution: IProjectResolution): boolean {
  if (resolution.isGlobal) {
    return session.project_worktree === "/" && resolve(session.directory) === resolution.directory;
  }

  return session.project_worktree === resolution.worktree;
}

function selectScopedSessions(
  sessions: readonly ISessionRow[],
  resolution: IProjectResolution,
  includeAllProjects: boolean,
): ISessionRow[] {
  if (includeAllProjects) {
    return [...sessions].sort((left, right) => right.time_updated - left.time_updated);
  }

  return sessions
    .filter((session) => matchesProjectResolution(session, resolution))
    .sort((left, right) => right.time_updated - left.time_updated);
}

function collectDescendantSessionIds(rootId: string, childrenByParentId: Map<string, string[]>): string[] {
  const sessionIds: string[] = [];
  const pending = [rootId];

  while (pending.length > 0) {
    const sessionId = pending.pop();
    if (!sessionId) {
      continue;
    }
    sessionIds.push(sessionId);
    const children = childrenByParentId.get(sessionId) ?? [];
    for (const childId of children) {
      pending.push(childId);
    }
  }

  return sessionIds;
}

function selectRootSessions(
  sessions: readonly ISessionRow[],
  resolution: IProjectResolution,
  includeAllProjects: boolean,
): ISessionRow[] {
  return selectScopedSessions(
    sessions.filter((session) => session.parent_id === null),
    resolution,
    includeAllProjects,
  );
}

function extractTokenTotals(messageData: unknown): ITokenTotals {
  const input = getNumberPath(messageData, ["tokens", "input"]) ?? 0;
  const output = getNumberPath(messageData, ["tokens", "output"]) ?? 0;
  const cacheRead = getNumberPath(messageData, ["tokens", "cache", "read"]) ?? 0;
  const cacheWrite = getNumberPath(messageData, ["tokens", "cache", "write"]) ?? 0;
  const total =
    getNumberPath(messageData, ["tokens", "total"]) ?? input + output + cacheRead + cacheWrite;
  const reasoning = getNumberPath(messageData, ["tokens", "reasoning"]) ?? 0;
  return { input, output, cacheRead, cacheWrite, total, reasoning };
}

function extractModelLabel(messageData: unknown): string | undefined {
  const modelId = getStringPath(messageData, ["modelID"]);
  if (!modelId) {
    return undefined;
  }
  const providerId = getStringPath(messageData, ["providerID"]);
  return providerId ? `${providerId}/${modelId}` : modelId;
}

function extractToolName(partData: unknown): string | undefined {
  return getStringPath(partData, ["tool"]);
}

function extractMcpServerNames(partData: unknown): string[] {
  const names = new Set<string>();
  const possibleNames = [
    getStringPath(partData, ["server"]),
    getStringPath(partData, ["mcp"]),
    getStringPath(partData, ["mcpName"]),
    getStringPath(partData, ["state", "metadata", "server"]),
    getStringPath(partData, ["state", "metadata", "mcp"]),
    getStringPath(partData, ["state", "metadata", "mcpName"]),
    getStringPath(partData, ["state", "metadata", "serverName"]),
  ];

  for (const name of possibleNames) {
    if (name) {
      names.add(name);
    }
  }

  return [...names];
}

function buildReports(
  rootSessions: ISessionRow[],
  allSessions: ISessionRow[],
  assistantMessages: IMessageRow[],
  toolParts: IPartRow[],
): ISessionReport[] {
  const sessionById = new Map(allSessions.map((session) => [session.id, session]));
  const childrenByParentId = buildChildrenMap(allSessions);

  const assistantMessagesBySessionId = new Map<string, IMessageRow[]>();
  for (const message of assistantMessages) {
    const sessionMessages = assistantMessagesBySessionId.get(message.session_id) ?? [];
    sessionMessages.push(message);
    assistantMessagesBySessionId.set(message.session_id, sessionMessages);
  }

  const toolPartsBySessionId = new Map<string, IPartRow[]>();
  for (const part of toolParts) {
    const sessionParts = toolPartsBySessionId.get(part.session_id) ?? [];
    sessionParts.push(part);
    toolPartsBySessionId.set(part.session_id, sessionParts);
  }

  const reports = rootSessions.map((rootSession) => {
    const descendantSessionIds = collectDescendantSessionIds(rootSession.id, childrenByParentId);
    const descendantSessions = descendantSessionIds
      .map((sessionId) => sessionById.get(sessionId))
      .filter((session): session is ISessionRow => session !== undefined);

    const tokens: ITokenTotals = {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
      reasoning: 0,
    };
    let cost = 0;
    let toolCalls = 0;
    let startedAt = Math.min(...descendantSessions.map((session) => session.time_created));
    let updatedAt = Math.max(...descendantSessions.map((session) => session.time_updated));
    // Tool-part `time_updated` can drift far beyond real tool execution, so active-time
    // uses assistant turn intervals as the least-wrong workflow activity signal.
    const activityIntervals: ITimeInterval[] = [];
    const modelCounts = new Map<string, number>();
    const toolCounts = new Map<string, number>();
    const mcpCounts = new Map<string, number>();

    for (const sessionId of descendantSessionIds) {
      const sessionMessages = assistantMessagesBySessionId.get(sessionId) ?? [];
      for (const message of sessionMessages) {
        const messageData = parseJson(message.data);
        const messageTokens = extractTokenTotals(messageData);
        tokens.input += messageTokens.input;
        tokens.output += messageTokens.output;
        tokens.cacheRead += messageTokens.cacheRead;
        tokens.cacheWrite += messageTokens.cacheWrite;
        tokens.total += messageTokens.total;
        tokens.reasoning += messageTokens.reasoning;
        cost += getNumberPath(messageData, ["cost"]) ?? 0;

        const createdAt = getNumberPath(messageData, ["time", "created"]) ?? message.time_created;
        const completedAt = getNumberPath(messageData, ["time", "completed"]) ?? message.time_updated;
        startedAt = Math.min(startedAt, createdAt);
        updatedAt = Math.max(updatedAt, completedAt);
        activityIntervals.push(createInterval(createdAt, completedAt));

        const modelLabel = extractModelLabel(messageData);
        if (modelLabel) {
          incrementCount(modelCounts, modelLabel);
        }
      }

      const sessionToolParts = toolPartsBySessionId.get(sessionId) ?? [];
      for (const part of sessionToolParts) {
        toolCalls += 1;
        const partData = parseJson(part.data);
        const toolName = extractToolName(partData);
        if (toolName) {
          incrementCount(toolCounts, toolName);
        }

        for (const serverName of extractMcpServerNames(partData)) {
          incrementCount(mcpCounts, serverName);
        }

        updatedAt = Math.max(updatedAt, part.time_updated);
      }
    }

    const elapsedDurationMs = Math.max(0, updatedAt - startedAt);
    const activeDurationMs = sumMergedIntervals(activityIntervals, DEFAULT_IDLE_GAP_MS);
    const throughputDurationMs = activeDurationMs > 0 ? activeDurationMs : elapsedDurationMs;
    const outputTokensPerSecond = throughputDurationMs > 0 ? (tokens.output * 1000) / throughputDurationMs : 0;

    return {
      root: rootSession,
      totalSessions: descendantSessions.length,
      subagentSessions: descendantSessions.filter((session) => session.parent_id !== null).length,
      toolCalls,
      startedAt,
      updatedAt,
      elapsedDurationMs,
      activeDurationMs,
      outputTokensPerSecond,
      tokens,
      cost,
      models: sortCounts(modelCounts),
      tools: sortCounts(toolCounts),
      mcpServers: sortCounts(mcpCounts),
    };
  });

  return reports.sort((left, right) => right.updatedAt - left.updatedAt);
}

function printSessionTable(reports: ISessionReport[]): void {
  const totalActiveDurationMs = reports.reduce((total, report) => total + report.activeDurationMs, 0);
  const totalSubagentSessions = reports.reduce((total, report) => total + report.subagentSessions, 0);
  const totalCacheRead = reports.reduce((total, report) => total + report.tokens.cacheRead, 0);
  const totalCacheWrite = reports.reduce((total, report) => total + report.tokens.cacheWrite, 0);
  const totalTokens = reports.reduce((total, report) => total + report.tokens.total, 0);
  const totalCost = reports.reduce((total, report) => total + report.cost, 0);
  const totalToolCalls = reports.reduce((total, report) => total + report.toolCalls, 0);
  const rows = [
    [
      "Session",
      "Active",
      "Subagents",
      "Last Active",
      "Model",
      // "Input",
      // "Output",
      "Cache R",
      "Cache W",
      "Tokens",
      "Cost",
      "Tools",
    ],
    ...reports.map((report) => [
      `${report.root.title}\n  ${report.root.id}`,
      formatActiveSummaryDuration(report.activeDurationMs),
      formatInteger(report.subagentSessions),
      formatTimestamp(report.updatedAt),
      getPrimaryModelLabel(report.models),
      // formatInteger(report.tokens.input),
      // formatInteger(report.tokens.output),
      formatInteger(report.tokens.cacheRead),
      formatInteger(report.tokens.cacheWrite),
      formatInteger(report.tokens.total),
      formatCurrency(report.cost),
      formatInteger(report.toolCalls),
    ]),
    [
      `Total ${reports.length} sessions`,
      formatActiveSummaryDuration(totalActiveDurationMs),
      formatInteger(totalSubagentSessions),
      "",
      "",
      formatInteger(totalCacheRead),
      formatInteger(totalCacheWrite),
      formatInteger(totalTokens),
      formatCurrency(totalCost),
      formatInteger(totalToolCalls),
    ],
  ];

  process.stdout.write(
    table(rows, {
      border: getBorderCharacters("norc"),
      columns: {
        2: { alignment: "right" },
        5: { alignment: "right" },
        6: { alignment: "right" },
        7: { alignment: "right" },
        8: { alignment: "right" },
        9: { alignment: "right" },
      },
    }),
  );
}

function printDetails(report: ISessionReport): void {
  const rows = [
    ["title", report.root.title],
    ["session", report.root.id],
    ["started", formatTimestamp(report.startedAt)],
    ["last active", formatTimestamp(report.updatedAt)],
    ["active", `${formatDuration(report.activeDurationMs)} (gap ${DEFAULT_IDLE_GAP_LABEL})`],
    ["elapsed", formatDuration(report.elapsedDurationMs)],
    ["sessions", `${report.totalSessions} total, ${report.subagentSessions} subagent`],
    ["models", formatCountList(report.models)],
    ["cost", formatCurrency(report.cost)],
    ["tool calls", formatInteger(report.toolCalls)],
    [
      "tokens",
      `input=${formatInteger(report.tokens.input)}, output=${formatInteger(report.tokens.output)}, cache_write=${formatInteger(report.tokens.cacheWrite)}, cache_read=${formatInteger(report.tokens.cacheRead)}, total=${formatInteger(report.tokens.total)}`,
    ],
    ["tok/s", formatRate(report.outputTokensPerSecond)],
    ["tools", formatCountList(report.tools)],
    ["mcp", formatCountList(report.mcpServers)],
  ];

  console.log("");
  process.stdout.write(
    table(rows, {
      border: getBorderCharacters("norc"),
      drawHorizontalLine: (lineIndex, rowCount) => lineIndex === 0 || lineIndex === rowCount,
      columns: {
        0: { width: 12 },
      },
    }),
  );
}

function getSelectedReport(reports: ISessionReport[], sessionId: string): ISessionReport | undefined {
  return reports.find((report) => report.root.id === sessionId);
}

function printScopedHeader(scopeLabel: string, reports: ISessionReport[], sessionId: string | undefined): void {
  console.log(`Scope: ${scopeLabel}`);
  console.log(`Root sessions: ${reports.length}`);
  console.log(`Active gap: ${DEFAULT_IDLE_GAP_LABEL}`);
  console.log(`Detail mode: ${sessionId ? `session ${sessionId}` : "summary only"}`);
}

function getSkillsScopeLabel(resolution: IProjectResolution, includeAllProjects: boolean): string {
  if (includeAllProjects) {
    return "all projects";
  }

  return resolution.isGlobal ? resolution.directory : resolution.worktree;
}

function getSessionsScopeLabel(resolution: IProjectResolution, includeAllProjects: boolean): string {
  if (includeAllProjects) {
    return "all projects";
  }

  return resolution.isGlobal ? "current directory" : "current project";
}

function ensureStorageExists(): void {
  if (existsSync(DB_PATH)) {
    return;
  }
  if (existsSync(LEGACY_STORAGE_DIR)) {
    throw new Error(
      `Found legacy OpenCode storage at ${LEGACY_STORAGE_DIR}, but this report tool requires the current SQLite database at ${DB_PATH}`,
    );
  }
  throw new Error(`OpenCode SQLite database not found at ${DB_PATH}`);
}

function runSkillsCommand(options: ISkillsCommandOptions): void {
  ensureStorageExists();
  const resolution = resolveProject(resolve(process.cwd()));
  const includeAllProjects = options.all === true;
  const scopeLabel = includeAllProjects ? "All projects" : getSkillsScopeLabel(resolution, false);

  using database = new Database(DB_PATH, { readonly: true, strict: true });
  const sessions = selectScopedSessions(readSessions(database), resolution, includeAllProjects);
  const report = createSkillUsageReport({
    overallLabel: scopeLabel,
    sessions,
    toolParts: readToolParts(database),
  });
  process.stdout.write(
    formatSkillUsageReport({
      report,
      showAllProjects: false,
    }),
  );
}

function runSessionsCommand(options: ISessionsCommandOptions): void {
  ensureStorageExists();
  const resolution = resolveProject(resolve(process.cwd()));
  const includeAllProjects = options.all === true;

  using database = new Database(DB_PATH, { readonly: true, strict: true });
  const sessions = readSessions(database);
  const rootSessions = selectRootSessions(sessions, resolution, includeAllProjects);

  if (rootSessions.length === 0) {
    console.log(`No sessions found for ${getSessionsScopeLabel(resolution, includeAllProjects)}`);
    return;
  }

  const reports = buildReports(rootSessions, sessions, readAssistantMessages(database), readToolParts(database));
  const scopeLabel = getSessionsScopeLabel(resolution, includeAllProjects);

  if (options.sessionId) {
    const report = getSelectedReport(reports, options.sessionId);
    if (!report) {
      throw new Error(`Session ${options.sessionId} not found in ${scopeLabel}`);
    }

    printScopedHeader(scopeLabel, reports, options.sessionId);
    printDetails(report);
    return;
  }

  printScopedHeader(scopeLabel, reports, options.sessionId);

  printSessionTable(reports);
}

async function runSyncSkillsCommand(options: ISkillsCommandOptions): Promise<void> {
  ensureStorageExists();

  const resolution = resolveProject(resolve(process.cwd()));
  const projectRootPath = getProjectRootPath(resolution);
  const registryRootPath = resolveRegistryRoot(options.registryDir);
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
  const availableSkillSources = await readSyncableSkillSources(registryRootPath);
  const availableSkillDirByName = new Map(
    [...availableSkillSources.entries()].map(([name, source]) => [name, source.sourceDirPath]),
  );

  using database = new Database(DB_PATH, { readonly: true, strict: true });
  const sessions = selectScopedSessions(readSessions(database), resolution, false);
  const usedSkills = createSkillUsageReport({
    sessions,
    toolParts: readToolParts(database),
  }).overall.skills;

  const result = await syncProjectSkills({
    availableSkillDirByName,
    autoConfirm: options.yes === true,
    confirmOverwrite: isInteractive ? promptToConfirmOverwrite : undefined,
    isInteractive,
    pickSkills: isInteractive ? promptForSkillSelection : undefined,
    projectRootPath,
    promptForSelection: options.pick === true,
    registryRootPath,
    usedSkills,
  });

  console.log(`Synced ${result.selectedSkills.length} skills into ${result.skillsDirPath}`);
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Skills: ${result.selectedSkills.length > 0 ? result.selectedSkills.join(", ") : "none"}`);

  for (const warningMessage of result.warningMessages) {
    console.warn(`Warning: ${warningMessage}`);
  }
}

function createProgram(): Command {
  const program = new Command();
  program.name(COMMAND_NAME);
  program.description("Reports OpenCode sessions and skill usage using the current SQLite storage.");

  program
    .command("skills")
    .description("Show skill usage across sessions or sync selected skills")
    .option("--all", "Include all known sessions across all projects (for reporting)")
    .option("--sync", "Sync selected used skills into the current project's .opencode directory")
    .option("--pick", "Interactively choose skills instead of reusing the saved manifest selection (requires --sync)")
    .option("--yes", "Overwrite managed project-local skill files without prompting (requires --sync)")
    .option("--registry-dir <path>", "Path to an ai-registry checkout that contains syncable skills (requires --sync)")
    .action(async (options: ISkillsCommandOptions) => {
      if (options.sync) {
        await runSyncSkillsCommand(options);
      } else {
        runSkillsCommand(options);
      }
    });

  program
    .command("sessions")
    .option("--all", "Include all known sessions across all projects")
    .option("--session <id>", "Show detailed output for one session in the selected scope")
    .action((options: { all?: boolean; session?: string }) => {
      runSessionsCommand({
        all: options.all,
        sessionId: options.session,
      });
      });

  return program;
}

async function main(): Promise<void> {
  const program = createProgram();

  if (Bun.argv.length <= 2) {
    console.log(program.helpInformation());
    return;
  }

  await program.parseAsync(Bun.argv);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
