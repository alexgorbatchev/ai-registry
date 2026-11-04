import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "shell-quote";
import type { Runner } from "../herdr";
import { spawnRunner } from "../herdr";
import {
  buildFocusCommand,
  buildPushArguments,
  finalMessage,
  MAX_BODY_LENGTH,
  parseAgent,
  runStop,
} from "../herdrTurnNotification";

const HOOK = join(import.meta.dir, "..", "herdrTurnNotification.ts");

function stopInput(fields: Record<string, unknown> = {}): string {
  return JSON.stringify({
    hook_event_name: "Stop",
    cwd: "/work/repos/aerospace-sidebar",
    last_assistant_message: "Release **v0.0.1** is out.\n\nNext: install it.",
    ...fields,
  });
}

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
    HERDR_WORKSPACE_ID: "w2Y",
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

test("puts the final message on one line", () => {
  expect(finalMessage(stopInput())).toBe("Release **v0.0.1** is out. Next: install it.");
});

test("cuts a long final message to the card's length without splitting a character", () => {
  const message = finalMessage(stopInput({ last_assistant_message: `${"a".repeat(MAX_BODY_LENGTH)}👩‍💻 tail` }));
  expect(message?.endsWith("…")).toBe(true);
  expect([...new Intl.Segmenter().segment(message ?? "")]).toHaveLength(MAX_BODY_LENGTH);
  const emoji = finalMessage(stopInput({ last_assistant_message: "👩‍💻".repeat(MAX_BODY_LENGTH + 1) }));
  expect(emoji).toBe(`${"👩‍💻".repeat(MAX_BODY_LENGTH - 1)}…`);
  const exact = "b".repeat(MAX_BODY_LENGTH);
  expect(finalMessage(stopInput({ last_assistant_message: exact }))).toBe(exact);
});

test("finds no final message in unusable input", () => {
  expect(finalMessage(stopInput({ last_assistant_message: null }))).toBeUndefined();
  expect(finalMessage(stopInput({ last_assistant_message: " \n " }))).toBeUndefined();
  expect(finalMessage("not json")).toBeUndefined();
});

test("titles a card without a project after the agent and leaves out an empty body", () => {
  expect(buildPushArguments({ agent: "codex", focusCommand: "focus", project: undefined, message: undefined })).toEqual(
    ["notification", "push", "--title", "Codex", "--icon", "codex", "--run", "focus"],
  );
});

test("pushes a card titled with the workspace label that shows the final message", async () => {
  await fakeSidebar();
  const herdr = await script("herdr", `printf '%s' '{"result":{"workspace":{"label":"sidebar"}}}'`);
  const env = herdrEnv(herdr);
  expect(await runStop("claude", stopInput(), env, spawnRunner)).toBe(true);
  expect(await pushedArguments()).toEqual([
    "notification",
    "push",
    "--title",
    "sidebar",
    "--body",
    "Release **v0.0.1** is out. Next: install it.",
    "--icon",
    "claude",
    "--run",
    buildFocusCommand(env) ?? "",
  ]);
});

test("titles the card with the project folder when Herdr does not answer", async () => {
  await fakeSidebar();
  const herdr = await script("herdr", "exit 1");
  expect(await runStop("codex", stopInput(), herdrEnv(herdr), spawnRunner)).toBe(true);
  expect((await pushedArguments()).slice(2, 4)).toEqual(["--title", "aerospace-sidebar"]);
});

test("does nothing outside Herdr or without the sidebar CLI", async () => {
  const unused: Runner = async () => {
    throw new Error("must not run");
  };
  expect(await runStop("claude", stopInput(), { PATH: bin }, unused)).toBe(true);
  expect(await runStop("claude", stopInput(), herdrEnv("herdr"), unused)).toBe(true);
});

test("reports a failed push", async () => {
  await fakeSidebar(1);
  expect(await runStop("claude", stopInput(), herdrEnv(join(bin, "missing-herdr")), spawnRunner)).toBe(false);
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
    child.stdin.write(stopInput());
    child.stdin.end();
    const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
    return { code: await child.exited, stdout, stderr };
  };
  expect(await run(["claude"], herdrEnv(herdr))).toEqual({ code: 0, stdout: "", stderr: "" });
  expect(await pushedArguments()).toContain("Release **v0.0.1** is out. Next: install it.");

  const missingAgent = await run([], herdrEnv(herdr));
  expect(missingAgent.code).toBe(1);
  expect(missingAgent.stderr).toContain("expected the agent");

  await fakeSidebar(1);
  const failed = await run(["codex"], herdrEnv(herdr));
  expect(failed.code).toBe(1);
  expect(failed.stderr).toContain("push failed");
});
