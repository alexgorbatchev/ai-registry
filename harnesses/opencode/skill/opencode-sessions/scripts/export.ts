#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface IEventRow {
  id: string;
  aggregate_id: string;
  seq: number;
  type: string;
  data: string;
}

interface IEventSequenceRow {
  aggregate_id: string;
  seq: number;
}

interface IMessageRow {
  id: string;
  session_id: string;
  time_created: number;
  time_updated: number;
  data: string;
}

interface IParsedEvent {
  id: string;
  aggregate_id: string;
  seq: number;
  type: string;
  data: unknown;
}

interface IParsedMessage {
  id: string;
  session_id: string;
  time_created: number;
  time_updated: number;
  data: unknown;
}

interface IParsedPart {
  id: string;
  message_id: string;
  session_id: string;
  time_created: number;
  time_updated: number;
  data: unknown;
}

interface IParsedPermission {
  project_id: string;
  time_created: number;
  time_updated: number;
  data: unknown;
}

interface IPartRow {
  id: string;
  message_id: string;
  session_id: string;
  time_created: number;
  time_updated: number;
  data: string;
}

interface IPermissionRow {
  project_id: string;
  time_created: number;
  time_updated: number;
  data: string;
}

interface IProjectRow {
  id: string;
  worktree: string;
  vcs: string | null;
  name: string | null;
  icon_url: string | null;
  icon_color: string | null;
  time_created: number;
  time_updated: number;
  time_initialized: number | null;
  sandboxes: string;
  commands: string | null;
}

interface ISessionRow {
  id: string;
  project_id: string;
  workspace_id: string | null;
  parent_id: string | null;
  slug: string;
  directory: string;
  title: string;
  version: string;
  share_url: string | null;
  summary_additions: number | null;
  summary_deletions: number | null;
  summary_files: number | null;
  summary_diffs: string | null;
  revert: string | null;
  permission: string | null;
  time_created: number;
  time_updated: number;
  time_compacting: number | null;
  time_archived: number | null;
}

interface ISessionShareRow {
  session_id: string;
  id: string;
  secret: string;
  url: string;
  time_created: number;
  time_updated: number;
}

interface ISessionTreeRow extends ISessionRow {
  depth: number;
}

interface ITodoRow {
  session_id: string;
  content: string;
  status: string;
  priority: string;
  position: number;
  time_created: number;
  time_updated: number;
}

interface IWorkspaceRow {
  id: string;
  branch: string | null;
  project_id: string;
  type: string;
  name: string | null;
  directory: string | null;
  extra: string | null;
}

interface IExportArguments {
  dbPath: string;
  outputDirectory: string;
  sessionId: string;
}

interface IExportBundle {
  eventSequences: IEventSequenceRow[];
  events: IParsedEvent[];
  messages: IParsedMessage[];
  parts: IParsedPart[];
  permission: IParsedPermission[];
  project: IProjectRow[];
  projectSessions: ISessionRow[];
  rootSession: ISessionRow;
  sessionShares: ISessionShareRow[];
  sessionTree: ISessionTreeRow[];
  todos: ITodoRow[];
  workspaces: IWorkspaceRow[];
}

const DEFAULT_DATA_DIR = join(process.env.XDG_DATA_HOME ?? join(process.env.HOME ?? "", ".local", "share"), "opencode");
const DEFAULT_DB_PATH = join(DEFAULT_DATA_DIR, "opencode.db");
const DEFAULT_OUTPUT_DIRECTORY = "long-session";

const SESSION_TREE_CTE = `
  WITH RECURSIVE session_tree(id, depth) AS (
    SELECT id, 0
    FROM session
    WHERE id = ?1

    UNION ALL

    SELECT child.id, session_tree.depth + 1
    FROM session child
    JOIN session_tree ON child.parent_id = session_tree.id
  )
`;

function parseJson(text: string): unknown {
  const parsedValue: unknown = JSON.parse(text);
  return parsedValue;
}

function printUsage(): void {
  console.error("Usage: bun scripts/export.ts <session-id> [output-directory] [--db <path-to-opencode.db>]");
  console.error("- output-directory defaults to ./long-session");
  console.error("- exports NDJSON files plus SESSION.md into that directory");
}

function parseArguments(argv: string[]): IExportArguments {
  let dbPath = DEFAULT_DB_PATH;
  const positionalArguments: string[] = [];

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      printUsage();
      process.exit(0);
    }

    if (argument === "--db") {
      const nextArgument = argv[index + 1];
      if (!nextArgument) {
        throw new Error("Missing value for --db");
      }

      dbPath = nextArgument;
      index += 1;
      continue;
    }

    positionalArguments.push(argument);
  }

  const sessionId = positionalArguments[0];
  if (!sessionId) {
    throw new Error("Missing required session id");
  }

  return {
    dbPath,
    outputDirectory: positionalArguments[1] ?? DEFAULT_OUTPUT_DIRECTORY,
    sessionId,
  };
}

function getRootSession(database: Database, sessionId: string): ISessionRow {
  const session = database
    .query<ISessionRow, [string]>(
      `SELECT
        id,
        project_id,
        workspace_id,
        parent_id,
        slug,
        directory,
        title,
        version,
        share_url,
        summary_additions,
        summary_deletions,
        summary_files,
        summary_diffs,
        revert,
        permission,
        time_created,
        time_updated,
        time_compacting,
        time_archived
      FROM session
      WHERE id = ?1`,
    )
    .get(sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  return session;
}

function getSessionTree(database: Database, sessionId: string): ISessionTreeRow[] {
  return database
    .query<ISessionTreeRow, [string]>(
      `${SESSION_TREE_CTE}
      SELECT
        session.id,
        session.project_id,
        session.workspace_id,
        session.parent_id,
        session.slug,
        session.directory,
        session.title,
        session.version,
        session.share_url,
        session.summary_additions,
        session.summary_deletions,
        session.summary_files,
        session.summary_diffs,
        session.revert,
        session.permission,
        session.time_created,
        session.time_updated,
        session.time_compacting,
        session.time_archived,
        session_tree.depth
      FROM session_tree
      JOIN session ON session.id = session_tree.id
      ORDER BY session.time_created, session.id`,
    )
    .all(sessionId);
}

function getProject(database: Database, projectId: string): IProjectRow[] {
  return database
    .query<IProjectRow, [string]>(
      `SELECT
        id,
        worktree,
        vcs,
        name,
        icon_url,
        icon_color,
        time_created,
        time_updated,
        time_initialized,
        sandboxes,
        commands
      FROM project
      WHERE id = ?1`,
    )
    .all(projectId);
}

function getProjectSessions(database: Database, projectId: string): ISessionRow[] {
  return database
    .query<ISessionRow, [string]>(
      `SELECT
        id,
        project_id,
        workspace_id,
        parent_id,
        slug,
        directory,
        title,
        version,
        share_url,
        summary_additions,
        summary_deletions,
        summary_files,
        summary_diffs,
        revert,
        permission,
        time_created,
        time_updated,
        time_compacting,
        time_archived
      FROM session
      WHERE project_id = ?1
      ORDER BY time_created, id`,
    )
    .all(projectId);
}

function getWorkspaces(database: Database, sessionId: string): IWorkspaceRow[] {
  return database
    .query<IWorkspaceRow, [string]>(
      `${SESSION_TREE_CTE}
      SELECT DISTINCT
        workspace.id,
        workspace.branch,
        workspace.project_id,
        workspace.type,
        workspace.name,
        workspace.directory,
        workspace.extra
      FROM session_tree
      JOIN session ON session.id = session_tree.id
      JOIN workspace ON workspace.id = session.workspace_id
      ORDER BY workspace.id`,
    )
    .all(sessionId);
}

function getPermission(database: Database, projectId: string): IParsedPermission[] {
  const rows = database
    .query<IPermissionRow, [string]>(
      `SELECT
        project_id,
        time_created,
        time_updated,
        data
      FROM permission
      WHERE project_id = ?1`,
    )
    .all(projectId);

  return rows.map((row) => ({
    project_id: row.project_id,
    time_created: row.time_created,
    time_updated: row.time_updated,
    data: parseJson(row.data),
  }));
}

function getSessionShares(database: Database, sessionId: string): ISessionShareRow[] {
  return database
    .query<ISessionShareRow, [string]>(
      `${SESSION_TREE_CTE}
      SELECT
        session_share.session_id,
        session_share.id,
        session_share.secret,
        session_share.url,
        session_share.time_created,
        session_share.time_updated
      FROM session_tree
      JOIN session_share ON session_share.session_id = session_tree.id
      ORDER BY session_share.time_created, session_share.id`,
    )
    .all(sessionId);
}

function getEventSequences(database: Database, sessionId: string): IEventSequenceRow[] {
  return database
    .query<IEventSequenceRow, [string]>(
      `${SESSION_TREE_CTE}
      SELECT
        event_sequence.aggregate_id,
        event_sequence.seq
      FROM session_tree
      JOIN event_sequence ON event_sequence.aggregate_id = session_tree.id
      ORDER BY event_sequence.aggregate_id`,
    )
    .all(sessionId);
}

function getEvents(database: Database, sessionId: string): IParsedEvent[] {
  const rows = database
    .query<IEventRow, [string]>(
      `${SESSION_TREE_CTE}
      SELECT
        event.id,
        event.aggregate_id,
        event.seq,
        event.type,
        event.data
      FROM session_tree
      JOIN event ON event.aggregate_id = session_tree.id
      ORDER BY event.aggregate_id, event.seq, event.id`,
    )
    .all(sessionId);

  return rows.map((row) => ({
    id: row.id,
    aggregate_id: row.aggregate_id,
    seq: row.seq,
    type: row.type,
    data: parseJson(row.data),
  }));
}

function getTodos(database: Database, sessionId: string): ITodoRow[] {
  return database
    .query<ITodoRow, [string]>(
      `${SESSION_TREE_CTE}
      SELECT
        todo.session_id,
        todo.content,
        todo.status,
        todo.priority,
        todo.position,
        todo.time_created,
        todo.time_updated
      FROM session_tree
      JOIN todo ON todo.session_id = session_tree.id
      ORDER BY todo.session_id, todo.position`,
    )
    .all(sessionId);
}

function getMessages(database: Database, sessionId: string): IParsedMessage[] {
  const rows = database
    .query<IMessageRow, [string]>(
      `${SESSION_TREE_CTE}
      SELECT
        message.id,
        message.session_id,
        message.time_created,
        message.time_updated,
        message.data
      FROM session_tree
      JOIN message ON message.session_id = session_tree.id
      ORDER BY message.time_created, message.id`,
    )
    .all(sessionId);

  return rows.map((row) => ({
    id: row.id,
    session_id: row.session_id,
    time_created: row.time_created,
    time_updated: row.time_updated,
    data: parseJson(row.data),
  }));
}

function getParts(database: Database, sessionId: string): IParsedPart[] {
  const rows = database
    .query<IPartRow, [string]>(
      `${SESSION_TREE_CTE}
      SELECT
        part.id,
        part.message_id,
        part.session_id,
        part.time_created,
        part.time_updated,
        part.data
      FROM session_tree
      JOIN message ON message.session_id = session_tree.id
      JOIN part ON part.message_id = message.id
      ORDER BY part.time_created, part.id`,
    )
    .all(sessionId);

  return rows.map((row) => ({
    id: row.id,
    message_id: row.message_id,
    session_id: row.session_id,
    time_created: row.time_created,
    time_updated: row.time_updated,
    data: parseJson(row.data),
  }));
}

function buildExportBundle(database: Database, sessionId: string): IExportBundle {
  const rootSession = getRootSession(database, sessionId);

  return {
    eventSequences: getEventSequences(database, sessionId),
    events: getEvents(database, sessionId),
    messages: getMessages(database, sessionId),
    parts: getParts(database, sessionId),
    permission: getPermission(database, rootSession.project_id),
    project: getProject(database, rootSession.project_id),
    projectSessions: getProjectSessions(database, rootSession.project_id),
    rootSession,
    sessionShares: getSessionShares(database, sessionId),
    sessionTree: getSessionTree(database, sessionId),
    todos: getTodos(database, sessionId),
    workspaces: getWorkspaces(database, sessionId),
  };
}

function formatTime(time: number | null): string {
  if (time === null) {
    return "n/a";
  }

  return new Date(time).toISOString();
}

function getLastUpdatedTime(bundle: IExportBundle): number {
  let maxTime = bundle.rootSession.time_updated;

  for (const session of bundle.sessionTree) {
    if (session.time_updated > maxTime) {
      maxTime = session.time_updated;
    }
  }

  return maxTime;
}

function buildSessionMarkdown(bundle: IExportBundle, dbPath: string): string {
  const childSessionCount = Math.max(bundle.sessionTree.length - 1, 0);
  const lines = [
    `# Session Export: ${bundle.rootSession.id}`,
    "",
    "## Summary",
    "",
    `- Root session id: \`${bundle.rootSession.id}\``,
    `- Root title: ${bundle.rootSession.title}`,
    `- Session slug: \`${bundle.rootSession.slug}\``,
    `- Project id: \`${bundle.rootSession.project_id}\``,
    `- Export generated at: ${new Date().toISOString()}`,
    `- Source DB: \`${dbPath}\``,
    `- Root session created: ${formatTime(bundle.rootSession.time_created)}`,
    `- Latest subtree update: ${formatTime(getLastUpdatedTime(bundle))}`,
    `- Session tree size: ${bundle.sessionTree.length} sessions (${childSessionCount} descendants)`,
    `- Project timeline size: ${bundle.projectSessions.length} sessions`,
    "",
    "## Files",
    "",
    "- `SESSION.md`: this overview and file guide",
    "- `session-tree.ndjson`: root session plus all descendant/subagent sessions with `depth`",
    "- `project-sessions.ndjson`: all sessions in the same project for broader timeline context",
    "- `project.ndjson`: project metadata row",
    "- `workspaces.ndjson`: workspace rows referenced by the session tree",
    "- `permissions.ndjson`: project permission row with parsed JSON data",
    "- `session-shares.ndjson`: session share rows for the session tree",
    "- `event-sequences.ndjson`: event sequence rows for the session tree",
    "- `events.ndjson`: event rows for the session tree with parsed JSON payloads",
    "- `todos.ndjson`: todo rows for the session tree",
    "- `messages.ndjson`: message rows for the session tree with parsed JSON payloads",
    "- `parts.ndjson`: part rows for the session tree with parsed JSON payloads",
    "",
    "## Counts",
    "",
    `- Sessions in subtree: ${bundle.sessionTree.length}`,
    `- Sessions in project timeline: ${bundle.projectSessions.length}`,
    `- Workspaces: ${bundle.workspaces.length}`,
    `- Permission rows: ${bundle.permission.length}`,
    `- Session share rows: ${bundle.sessionShares.length}`,
    `- Event sequence rows: ${bundle.eventSequences.length}`,
    `- Event rows: ${bundle.events.length}`,
    `- Todo rows: ${bundle.todos.length}`,
    `- Message rows: ${bundle.messages.length}`,
    `- Part rows: ${bundle.parts.length}`,
    "",
    "## Notes",
    "",
    "- This export is optimized for deep analysis of a long-running session tree, not for lossless full-database backup.",
    "- `account` and `account_state` are intentionally excluded because they contain auth/account state rather than session context.",
    "- NDJSON is used so analysis tooling can stream large files without loading the whole export at once.",
  ];

  return `${lines.join("\n")}\n`;
}

async function writeNdjsonFile(path: string, rows: unknown[]): Promise<void> {
  const text = rows.map((row) => JSON.stringify(row)).join("\n");
  await writeFile(path, text.length > 0 ? `${text}\n` : "", "utf8");
}

async function writeBundle(outputDirectory: string, bundle: IExportBundle, dbPath: string): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });

  await Promise.all([
    writeFile(join(outputDirectory, "SESSION.md"), buildSessionMarkdown(bundle, dbPath), "utf8"),
    writeNdjsonFile(join(outputDirectory, "session-tree.ndjson"), bundle.sessionTree),
    writeNdjsonFile(join(outputDirectory, "project-sessions.ndjson"), bundle.projectSessions),
    writeNdjsonFile(join(outputDirectory, "project.ndjson"), bundle.project),
    writeNdjsonFile(join(outputDirectory, "workspaces.ndjson"), bundle.workspaces),
    writeNdjsonFile(join(outputDirectory, "permissions.ndjson"), bundle.permission),
    writeNdjsonFile(join(outputDirectory, "session-shares.ndjson"), bundle.sessionShares),
    writeNdjsonFile(join(outputDirectory, "event-sequences.ndjson"), bundle.eventSequences),
    writeNdjsonFile(join(outputDirectory, "events.ndjson"), bundle.events),
    writeNdjsonFile(join(outputDirectory, "todos.ndjson"), bundle.todos),
    writeNdjsonFile(join(outputDirectory, "messages.ndjson"), bundle.messages),
    writeNdjsonFile(join(outputDirectory, "parts.ndjson"), bundle.parts),
  ]);
}

async function main(): Promise<void> {
  const { dbPath, outputDirectory, sessionId } = parseArguments(Bun.argv);

  using database = new Database(dbPath, { readonly: true, strict: true });
  const bundle = buildExportBundle(database, sessionId);

  await writeBundle(outputDirectory, bundle, dbPath);

  console.error(`Exported ${sessionId} bundle to ${outputDirectory}`);
  console.error(`Sessions: ${bundle.sessionTree.length} subtree / ${bundle.projectSessions.length} project timeline`);
  console.error(`Messages: ${bundle.messages.length}`);
  console.error(`Parts: ${bundle.parts.length}`);
}

await main();
