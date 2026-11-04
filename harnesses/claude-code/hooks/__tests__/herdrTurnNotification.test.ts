import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "shell-quote";
import {
  buildFocusCommand,
  buildPushArguments,
  parseAgent,
  projectName,
  readPaneTitle,
  runStop,
  spawnRunner,
  type Runner,
} from "../herdrTurnNotification";

const HOOK = join(import.meta.dir, "..", "herdrTurnNotification.ts");

const STOP_INPUT = JSON.stringify({ hook_event_name: "Stop", cwd: "/work/repos/aerospace-sidebar" });

let bin: string;
let pushLog: string;

/** Write an executable shell script into the fake bin directory. */
async function script(name: string, body: string): Promise<string> {
  const path = join(bin, name);
  await writeFile(path, `#!/bin/sh\n${body}\n`);
  await chmod(path, 0o755);
  return path;
}

/** Install a fake sidebar CLI that records each argument on its own line. */
async function fakeSidebar(exitCode = 0): Promise<void> {
  await script("aerospace-sidebar", `for a in "$@"; do printf '%s\\n' "$a" >> '${pushLog}'; done; exit ${exitCode}`);
}

async function pushedArguments(): Promise<string[]> {
  return (await readFile(pushLog, "utf8")).trimEnd().split("\n");
}

function herdrEnv(herdrBin: string): Record<string, string> {
  return {
    PATH: `${bin}:/usr/bin:/bin`,
    HERDR_PANE_ID: "w2Y:p1",
    HERDR_BIN_PATH: herdrBin,
    HERDR_SOCKET_PATH: "/home/me/.config/herdr/herdr.sock",
    __CFBundleIdentifier: "com.mitchellh.ghostty",
  };
}

beforeEach(async () => {
  bin = await mkdtemp(join(tmpdir(), "herdr-turn-"));
  pushLog = join(bin, "push.log");
});

afterEach(async () => {
  await rm(bin, { recursive: true, force: true });
});

test("accepts only the known agents", () => {
  expect(parseAgent("claude")).toBe("claude");
  expect(parseAgent("codex")).toBe("codex");
  expect(parseAgent("toString")).toBeUndefined();
  expect(parseAgent(undefined)).toBeUndefined();
});

test("focuses the pane through the socket, then brings the terminal forward", () => {
  const command = buildFocusCommand({ ...herdrEnv("/opt/herdr dir/herdr") });
  expect(parse(command ?? "")).toEqual([
    "HERDR_SOCKET_PATH=/home/me/.config/herdr/herdr.sock",
    "/opt/herdr dir/herdr",
    "agent",
    "focus",
    "w2Y:p1",
    { op: ";" },
    "open",
    "-b",
    "com.mitchellh.ghostty",
  ]);
});

test("focuses with herdr on PATH when nothing else is known", () => {
  expect(parse(buildFocusCommand({ HERDR_PANE_ID: "p1" }) ?? "")).toEqual(["herdr", "agent", "focus", "p1"]);
  expect(buildFocusCommand({})).toBeUndefined();
});

test("reads the pane title and ignores unusable answers", async () => {
  const answering =
    (stdout: string | undefined): Runner =>
    async () =>
      stdout;
  const env = { HERDR_PANE_ID: "p1" };
  expect(await readPaneTitle(env, answering(JSON.stringify({ result: { pane: { title: " Fix CI " } } })))).toBe(
    "Fix CI",
  );
  expect(await readPaneTitle(env, answering(JSON.stringify({ result: { pane: { title: "  " } } })))).toBeUndefined();
  expect(await readPaneTitle(env, answering("not json"))).toBeUndefined();
  expect(await readPaneTitle(env, answering(undefined))).toBeUndefined();
  expect(await readPaneTitle({}, answering("{}"))).toBeUndefined();
});

test("names the project from the hook input's cwd", () => {
  expect(projectName(STOP_INPUT)).toBe("aerospace-sidebar");
  expect(projectName("{}")).toBeUndefined();
  expect(projectName("")).toBeUndefined();
});

test("titles the card after the agent and leaves out an empty body", () => {
  expect(buildPushArguments({ agent: "codex", focusCommand: "focus", summary: undefined })).toEqual([
    "notification",
    "push",
    "--title",
    "Codex finished",
    "--icon",
    "codex",
    "--run",
    "focus",
  ]);
});

test("pushes a card with the pane title that focuses the pane", async () => {
  await fakeSidebar();
  const herdr = await script("herdr", `printf '%s' '{"result":{"pane":{"title":"Agent end-of-turn cards"}}}'`);
  const env = herdrEnv(herdr);
  expect(await runStop("claude", STOP_INPUT, env, spawnRunner)).toBe(true);
  expect(await pushedArguments()).toEqual([
    "notification",
    "push",
    "--title",
    "Claude finished",
    "--body",
    "Agent end-of-turn cards",
    "--icon",
    "claude",
    "--run",
    buildFocusCommand(env) ?? "",
  ]);
});

test("falls back to the project name when Herdr does not answer", async () => {
  await fakeSidebar();
  const herdr = await script("herdr", "exit 1");
  expect(await runStop("codex", STOP_INPUT, herdrEnv(herdr), spawnRunner)).toBe(true);
  expect(await pushedArguments()).toContain("aerospace-sidebar");
});

test("does nothing outside Herdr or without the sidebar CLI", async () => {
  const unused: Runner = async () => {
    throw new Error("must not run");
  };
  expect(await runStop("claude", STOP_INPUT, { PATH: bin }, unused)).toBe(true);
  expect(await runStop("claude", STOP_INPUT, herdrEnv("herdr"), unused)).toBe(true);
});

test("reports a failed push", async () => {
  await fakeSidebar(1);
  expect(await runStop("claude", STOP_INPUT, herdrEnv(join(bin, "missing-herdr")), spawnRunner)).toBe(false);
});

test("runs as a hook process", async () => {
  await fakeSidebar();
  const herdr = await script("herdr", "exit 1");
  const run = async (args: string[], env: Record<string, string>) => {
    const child = Bun.spawn(["bun", HOOK, ...args], {
      env: { ...env, PATH: `${env.PATH}:${process.env.PATH ?? ""}` },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    child.stdin.write(STOP_INPUT);
    child.stdin.end();
    const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
    return { code: await child.exited, stdout, stderr };
  };
  expect(await run(["claude"], herdrEnv(herdr))).toEqual({ code: 0, stdout: "", stderr: "" });
  expect(await pushedArguments()).toContain("Claude finished");

  const missingAgent = await run([], herdrEnv(herdr));
  expect(missingAgent.code).toBe(1);
  expect(missingAgent.stderr).toContain("expected the agent");

  await fakeSidebar(1);
  const failed = await run(["codex"], herdrEnv(herdr));
  expect(failed.code).toBe(1);
  expect(failed.stderr).toContain("push failed");
});
