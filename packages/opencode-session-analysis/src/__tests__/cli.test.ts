import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

interface ICliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface IFixtureContext {
  dataHomePath: string;
  projectAPath: string;
  projectBPath: string;
  scratchPath: string;
}

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
const FIXTURE_ROOT = join(REPO_ROOT, ".tmp", "opencode-session-analysis-cli");
const CLI_PATH = join(REPO_ROOT, "packages", "opencode-session-analysis", "src", "cli.ts");
const FIXTURE_DAY = 24 * 60 * 60 * 1000;
const FIXTURE_DIRECTORIES = ["help", "skills", "sessions"];

function createFixtureContext(fixtureName: string): IFixtureContext {
  const fixturePath = join(FIXTURE_ROOT, fixtureName);
  rmSync(fixturePath, { recursive: true, force: true });
  mkdirSync(fixturePath, { recursive: true });

  const projectAPath = join(fixturePath, "project-a");
  const projectBPath = join(fixturePath, "project-b");
  const scratchPath = join(fixturePath, "scratch");
  const dataHomePath = join(fixturePath, "xdg-data");
  const opencodeDataPath = join(dataHomePath, "opencode");
  mkdirSync(projectAPath, { recursive: true });
  mkdirSync(projectBPath, { recursive: true });
  mkdirSync(scratchPath, { recursive: true });
  mkdirSync(opencodeDataPath, { recursive: true });

  initializeGitRepository(projectAPath);
  initializeGitRepository(projectBPath);
  createDatabase(join(opencodeDataPath, "opencode.db"), { projectAPath, projectBPath, scratchPath });

  return { dataHomePath, projectAPath, projectBPath, scratchPath };
}

function initializeGitRepository(directoryPath: string): void {
  const result = Bun.spawnSync({
    cmd: ["git", "init", directoryPath],
    cwd: REPO_ROOT,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to initialize git repository: ${result.stderr.toString().trim()}`);
  }
}

function createDatabase(
  databasePath: string,
  paths: { projectAPath: string; projectBPath: string; scratchPath: string },
): void {
  using database = new Database(databasePath, { create: true, strict: true });
  database.exec(`
    CREATE TABLE project (
      id TEXT PRIMARY KEY,
      worktree TEXT NOT NULL,
      name TEXT
    );

    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_id TEXT,
      slug TEXT NOT NULL,
      directory TEXT NOT NULL,
      title TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      time_archived INTEGER,
      FOREIGN KEY(project_id) REFERENCES project(id)
    );

    CREATE TABLE message (
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE part (
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);

  const baseTime = Date.UTC(2026, 3, 25, 12, 0, 0);
  database.run("INSERT INTO project (id, worktree, name) VALUES (?, ?, ?)", ["project-a", paths.projectAPath, "Project A"]);
  database.run("INSERT INTO project (id, worktree, name) VALUES (?, ?, ?)", ["project-b", paths.projectBPath, "Project B"]);
  database.run("INSERT INTO project (id, worktree, name) VALUES (?, ?, ?)", ["project-global", "/", "Global"]);

  database.run(
    "INSERT INTO session (id, project_id, parent_id, slug, directory, title, time_created, time_updated, time_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ["session-a", "project-a", null, "session-a", paths.projectAPath, "Project A root", baseTime, baseTime + 2 * FIXTURE_DAY, null],
  );
  database.run(
    "INSERT INTO session (id, project_id, parent_id, slug, directory, title, time_created, time_updated, time_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ["child-a", "project-a", "session-a", "child-a", paths.projectAPath, "Project A child", baseTime, baseTime + FIXTURE_DAY, null],
  );
  database.run(
    "INSERT INTO session (id, project_id, parent_id, slug, directory, title, time_created, time_updated, time_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ["session-b", "project-b", null, "session-b", paths.projectBPath, "Project B root", baseTime + 3 * FIXTURE_DAY, baseTime + 4 * FIXTURE_DAY, null],
  );
  database.run(
    "INSERT INTO session (id, project_id, parent_id, slug, directory, title, time_created, time_updated, time_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ["session-global", "project-global", null, "session-global", paths.scratchPath, "Scratch root", baseTime + 5 * FIXTURE_DAY, baseTime + 6 * FIXTURE_DAY, null],
  );

  database.run("INSERT INTO message (session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?)", [
    "session-a",
    baseTime,
    baseTime + 60_000,
    JSON.stringify({
      role: "assistant",
      providerID: "anthropic",
      modelID: "sonnet",
      cost: 0.12,
      time: { created: baseTime, completed: baseTime + 60_000 },
      tokens: { input: 30, output: 40, cache: { read: 10, write: 20 }, total: 100 },
    }),
  ]);
  database.run("INSERT INTO message (session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?)", [
    "child-a",
    baseTime + 2 * 60_000,
    baseTime + 3 * 60_000,
    JSON.stringify({
      role: "assistant",
      providerID: "anthropic",
      modelID: "sonnet",
      cost: 0.05,
      time: { created: baseTime + 2 * 60_000, completed: baseTime + 3 * 60_000 },
      tokens: { input: 10, output: 20, cache: { read: 0, write: 10 }, total: 40 },
    }),
  ]);
  database.run("INSERT INTO message (session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?)", [
    "session-b",
    baseTime + 3 * FIXTURE_DAY,
    baseTime + 3 * FIXTURE_DAY + 60_000,
    JSON.stringify({
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-4.1",
      cost: 0.2,
      time: { created: baseTime + 3 * FIXTURE_DAY, completed: baseTime + 3 * FIXTURE_DAY + 60_000 },
      tokens: { input: 20, output: 50, cache: { read: 5, write: 0 }, total: 75 },
    }),
  ]);
  database.run("INSERT INTO message (session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?)", [
    "session-global",
    baseTime + 5 * FIXTURE_DAY,
    baseTime + 5 * FIXTURE_DAY + 60_000,
    JSON.stringify({
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-4.1-mini",
      cost: 0.01,
      time: { created: baseTime + 5 * FIXTURE_DAY, completed: baseTime + 5 * FIXTURE_DAY + 60_000 },
      tokens: { input: 5, output: 15, cache: { read: 0, write: 0 }, total: 20 },
    }),
  ]);

  database.run("INSERT INTO part (session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?)", [
    "session-a",
    baseTime,
    baseTime,
    JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "bun" } } }),
  ]);
  database.run("INSERT INTO part (session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?)", [
    "child-a",
    baseTime + 10_000,
    baseTime + 10_000,
    JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "typescript-code-quality" } } }),
  ]);
  database.run("INSERT INTO part (session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?)", [
    "session-b",
    baseTime + 3 * FIXTURE_DAY,
    baseTime + 3 * FIXTURE_DAY,
    JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "readme-writer" } } }),
  ]);
  database.run("INSERT INTO part (session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?)", [
    "session-global",
    baseTime + 5 * FIXTURE_DAY,
    baseTime + 5 * FIXTURE_DAY,
    JSON.stringify({ type: "tool", tool: "skill", state: { input: { name: "opencode-sessions" } } }),
  ]);
}

function runCli(cwd: string, dataHomePath: string, args: string[]): ICliResult {
  const result = Bun.spawnSync({
    cmd: ["bun", CLI_PATH, ...args],
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      HOME: dataHomePath,
      XDG_DATA_HOME: dataHomePath,
      TZ: "UTC",
    },
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function normalizeCliOutput(output: string, fixture: IFixtureContext): string {
  const normalizedOutput = output
    .replaceAll(fixture.projectAPath, "<project-a>")
    .replaceAll(fixture.projectBPath, "<project-b>")
    .replaceAll(fixture.scratchPath, "<scratch>");

  return normalizedOutput
    .split("\n")
    .flatMap((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("┌") || trimmedLine.startsWith("├") || trimmedLine.startsWith("└")) {
        return [];
      }

      if (trimmedLine.startsWith("│") && trimmedLine.endsWith("│")) {
        const cells = trimmedLine
          .slice(1, -1)
          .split("│")
          .map((cell) => cell.trim());
        return [`| ${cells.join(" | ")} |`];
      }

      return [line];
    })
    .join("\n");
}

afterEach(() => {
  for (const fixtureName of FIXTURE_DIRECTORIES) {
    rmSync(join(FIXTURE_ROOT, fixtureName), { recursive: true, force: true });
  }
});

describe("cli", () => {
  it("shows command-based help", () => {
    const fixture = createFixtureContext("help");
    const result = runCli(fixture.projectAPath, fixture.dataHomePath, ["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatchInlineSnapshot(`
"Usage: opencode-session-analysis [options] [command]

Reports OpenCode sessions and skill usage using the current SQLite storage.

Options:
  -h, --help          display help for command

Commands:
  skills [options]    Show skill usage across sessions or sync selected skills
  sessions [options]
  help [command]      display help for command
"
`);
  });

  it("scopes the skills command to the current project by default and aggregates globally with --all", () => {
    const fixture = createFixtureContext("skills");
    const scopedResult = runCli(fixture.projectAPath, fixture.dataHomePath, ["skills"]);
    const globalResult = runCli(fixture.projectAPath, fixture.dataHomePath, ["skills", "--all"]);

    expect(scopedResult.exitCode).toBe(0);
    expect(scopedResult.stderr).toBe("");
    expect(normalizeCliOutput(scopedResult.stdout, fixture)).toMatchInlineSnapshot(`
"<project-a>
| Skill | Usages | Avg/day |
| bun | 1 | 1.00 |
| typescript-code-quality | 1 | 1.00 |
| Total | 2 | 2.00 |
"
`);

    expect(globalResult.exitCode).toBe(0);
    expect(globalResult.stderr).toBe("");
    expect(normalizeCliOutput(globalResult.stdout, fixture)).toMatchInlineSnapshot(`
"All projects
| Skill | Usages | Avg/day |
| bun | 1 | 0.17 |
| opencode-sessions | 1 | 0.17 |
| readme-writer | 1 | 0.17 |
| typescript-code-quality | 1 | 0.17 |
| Total | 4 | 0.67 |
"
`);
  });

  it("scopes the sessions command to the current project by default and aggregates globally with --all", () => {
    const fixture = createFixtureContext("sessions");
    const scopedResult = runCli(fixture.projectAPath, fixture.dataHomePath, ["sessions"]);
    const globalResult = runCli(fixture.projectAPath, fixture.dataHomePath, ["sessions", "--all"]);

    expect(scopedResult.exitCode).toBe(0);
    expect(scopedResult.stderr).toBe("");
    expect(normalizeCliOutput(scopedResult.stdout, fixture)).toMatchInlineSnapshot(`
"Scope: current project
Root sessions: 1
Active gap: 5m
Detail mode: summary only
| Session | Active | Subagents | Last Active | Model | Cache R | Cache W | Tokens | Cost | Tools |
| Project A root | 3m | 1 | 2026-04-27 12:00 | anthropic/sonnet | 10 | 30 | 140 | $0.17 | 2 |
| session-a |  |  |  |  |  |  |  |  |  |
| Total 1 sessions | 3m | 1 |  |  | 10 | 30 | 140 | $0.17 | 2 |
"
`);

    expect(globalResult.exitCode).toBe(0);
    expect(globalResult.stderr).toBe("");
    expect(normalizeCliOutput(globalResult.stdout, fixture)).toMatchInlineSnapshot(`
"Scope: all projects
Root sessions: 3
Active gap: 5m
Detail mode: summary only
| Session | Active | Subagents | Last Active | Model | Cache R | Cache W | Tokens | Cost | Tools |
| Scratch root | 1m | 0 | 2026-05-01 12:00 | openai/gpt-4.1-mini | 0 | 0 | 20 | $0.01 | 1 |
| session-global |  |  |  |  |  |  |  |  |  |
| Project B root | 1m | 0 | 2026-04-29 12:00 | openai/gpt-4.1 | 5 | 0 | 75 | $0.20 | 1 |
| session-b |  |  |  |  |  |  |  |  |  |
| Project A root | 3m | 1 | 2026-04-27 12:00 | anthropic/sonnet | 10 | 30 | 140 | $0.17 | 2 |
| session-a |  |  |  |  |  |  |  |  |  |
| Total 3 sessions | 5m | 1 |  |  | 15 | 30 | 235 | $0.38 | 4 |
"
`);
  });

  it("omits project directories from session detail output", () => {
    const fixture = createFixtureContext("sessions");
    const result = runCli(fixture.projectAPath, fixture.dataHomePath, ["sessions", "--session", "session-a"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(normalizeCliOutput(result.stdout, fixture)).toMatchInlineSnapshot(`
"Scope: current project
Root sessions: 1
Active gap: 5m
Detail mode: session session-a

| title | Project A root |
| session | session-a |
| started | 2026-04-25 12:00 |
| last active | 2026-04-27 12:00 |
| active | 3m 0s (gap 5m) |
| elapsed | 48h 0m 0s |
| sessions | 2 total, 1 subagent |
| models | anthropic/sonnet=2 |
| cost | $0.17 |
| tool calls | 2 |
| tokens | input=40, output=60, cache_write=30, cache_read=10, total=140 |
| tok/s | 0.33 |
| tools | skill=2 |
| mcp | none |
"
`);
  });
});
