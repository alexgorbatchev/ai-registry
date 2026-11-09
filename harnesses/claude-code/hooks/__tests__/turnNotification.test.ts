import { beforeEach, expect, test } from "bun:test";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { factory_testDirectory } from "./fixtures";
import { parse } from "shell-quote";
import type { Runner } from "../herdr";
import { spawnRunner } from "../herdr";
import {
  buildFocusCommand,
  buildPushArguments,
  closedMarkdown,
  finalMessage,
  MAX_BODY_LENGTH,
  parseAgent,
  resolveTarget,
  runStop,
} from "../turnNotification";

const HOOK = join(import.meta.dir, "..", "turnNotification.ts");

const T3_THREAD = "ab49f601-7254-4234-a7d6-b65abdee00b3";
const T3_APP_LINK = `t3code://threads/ded656bc-3e4c-42b3-be26-65fb25c7f480/${T3_THREAD}`;

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

/**
 * Install a fake sidebar CLI that records each argument on its own line; it refuses the options in `unknown` with a
 * usage error, as a CLI from before them does.
 */
async function fakeSidebar(exitCode = 0, unknown: string[] = []): Promise<void> {
  const refuse = unknown.map((option) => `for a in "$@"; do [ "$a" = ${option} ] && exit 64; done; `).join("");
  await script(
    "aerospace-sidebar",
    `${refuse}for a in "$@"; do printf '%s\\n' "$a" >> '${pushLog}'; done; exit ${exitCode}`,
  );
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

function t3Env(t3Bin: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    PATH: `${bin}:/usr/bin:/bin`,
    T3CODE_THREAD_ID: T3_THREAD,
    T3CODE_CLI_PATH: t3Bin,
    __CFBundleIdentifier: "com.t3tools.t3code",
    ...extra,
  };
}

/** Install a fake `t3` that answers `thread show` with a thread titled `title`, logging its arguments. */
async function fakeT3(title: string): Promise<string> {
  const thread = JSON.stringify({
    thread: {
      threadId: T3_THREAD,
      title,
      link: `https://app.t3.codes/threads/ded656bc-3e4c-42b3-be26-65fb25c7f480/${T3_THREAD}`,
    },
    messages: [],
  });
  return script("t3", `printf '%s ' "$@" > '${join(bin, "t3.log")}'; printf '%s' '${thread}'`);
}

/**
 * Install a fake `herdr` for a pane whose shell is this test process, which runs the hook in-process and starts it as
 * a child; it answers `workspace get` with `label`, or fails it without one.
 */
async function fakeHerdr(label?: string): Promise<string> {
  const processInfo = JSON.stringify({ result: { process_info: { shell_pid: process.pid } } });
  const workspace = label === undefined ? "exit 1" : `printf '%s' '{"result":{"workspace":{"label":"${label}"}}}'`;
  return script(
    "herdr",
    `[ "$2" = process-info ] && printf '%s' '${processInfo}' && exit 0\n[ "$1" = workspace ] && ${workspace} && exit 0\nexit 1`,
  );
}

/** Write a Codex rollout opening with `payload` as its session metadata, and return Stop input naming it. */
async function codexStopInput(payload: Record<string, unknown>): Promise<string> {
  const path = join(bin, "rollout.jsonl");
  await writeFile(path, `${JSON.stringify({ type: "session_meta", payload })}\n`);
  return stopInput({ session_id: "root", transcript_path: path });
}

beforeEach(async () => {
  bin = factory_testDirectory("herdr-turn");
  pushLog = join(bin, "push.log");
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

test("keeps the final message's line breaks, with at most one blank line in a row", () => {
  expect(finalMessage(stopInput())).toBe("Release **v0.0.1** is out.\n\nNext: install it.");
  const spaced = finalMessage(stopInput({ last_assistant_message: "\n  One  \r\n\r\n\r\n\r\nTwo\t\nThree \n" }));
  expect(spaced).toBe("One\n\nTwo\nThree");
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

test("cuts a long message where it leaves no markdown span open", () => {
  const filler = "x".repeat(MAX_BODY_LENGTH - 20);
  const cut = (tail: string) => finalMessage(stopInput({ last_assistant_message: `${filler} ${tail}` }));
  expect(cut("see [the docs](https://example.com/very/long/path/to/docs) now")).toBe(`${filler} see…`);
  expect(cut("run `make test --verbose` then")).toBe(`${filler} run…`);
  expect(cut("it is **very important that** you")).toBe(`${filler} it is…`);
  const shorter = "x".repeat(MAX_BODY_LENGTH - 30);
  const closedLink = finalMessage(
    stopInput({ last_assistant_message: `${shorter} ok [d](https://x.io) and *more emphasis here*` }),
  );
  expect(closedLink).toBe(`${shorter} ok [d](https://x.io) and…`);
});

test("closes nothing that is already closed", () => {
  for (const text of ["**bold** and `code` and [x](https://y.z) and ~~gone~~", "snake_case_name is fine", "a `**` b"]) {
    expect(closedMarkdown(text)).toBe(text);
  }
});

test("drops each kind of open span, innermost last", () => {
  expect(closedMarkdown("done [link](https://x")).toBe("done ");
  expect(closedMarkdown("done [link")).toBe("done ");
  expect(closedMarkdown("run `cmd")).toBe("run ");
  expect(closedMarkdown("**bold** and **open")).toBe("**bold** and ");
  expect(closedMarkdown("~~struck")).toBe("");
  expect(closedMarkdown("an *open one")).toBe("an ");
  expect(closedMarkdown("an _open one and snake_case")).toBe("an ");
  expect(closedMarkdown("**bold** *mixed")).toBe("**bold** ");
  // Each open span goes, the one opened last first.
  expect(closedMarkdown("**bold *mixed")).toBe("");
});

test("finds no final message in unusable input", () => {
  expect(finalMessage(stopInput({ last_assistant_message: null }))).toBeUndefined();
  expect(finalMessage(stopInput({ last_assistant_message: " \n " }))).toBeUndefined();
  expect(finalMessage("not json")).toBeUndefined();
});

test("titles a card without a title after the agent and leaves out an empty body", () => {
  expect(
    buildPushArguments({
      agent: "codex",
      title: undefined,
      action: { kind: "run", command: "focus" },
      message: undefined,
      markdown: true,
    }),
  ).toEqual(["notification", "push", "--title", "Codex", "--icon", "codex", "--run", "focus"]);
  expect(
    buildPushArguments({
      agent: "codex",
      title: "p",
      action: { kind: "run", command: "f" },
      message: "m",
      markdown: false,
    }),
  ).toEqual(["notification", "push", "--title", "p", "--body", "m", "--icon", "codex", "--run", "f"]);
});

test("opens a URL on click, or does nothing on click without an action", () => {
  expect(
    buildPushArguments({
      agent: "claude",
      title: "t",
      action: { kind: "open", url: T3_APP_LINK },
      message: undefined,
      markdown: true,
    }),
  ).toEqual(["notification", "push", "--title", "t", "--icon", "claude", "--open", T3_APP_LINK]);
  expect(
    buildPushArguments({ agent: "claude", title: "t", action: undefined, message: undefined, markdown: true }),
  ).toEqual(["notification", "push", "--title", "t", "--icon", "claude"]);
});

test("pushes a card for a T3 thread titled with the thread that opens it in the app", async () => {
  await fakeSidebar();
  const t3 = await fakeT3("Remove codegraph hooks");
  expect(await runStop("claude", stopInput(), t3Env(t3), spawnRunner)).toBe(true);
  expect(await readFile(join(bin, "t3.log"), "utf8")).toBe(`thread show ${T3_THREAD} --json --messages 0 `);
  expect(await pushedArguments()).toEqual([
    "notification",
    "push",
    "--title",
    "Remove codegraph hooks",
    "--body",
    "Release **v0.0.1** is out.",
    "",
    "Next: install it.",
    "--markdown",
    "--icon",
    "claude",
    "--open",
    T3_APP_LINK,
    "--key",
    `t3:${T3_THREAD}`,
  ]);
});

test("brings T3 forward and titles with the project folder when the T3 server does not answer", async () => {
  const t3 = await script("t3", "exit 1");
  expect(await resolveTarget(stopInput(), t3Env(t3), spawnRunner)).toEqual({
    title: "aerospace-sidebar",
    action: { kind: "run", command: "open -b com.t3tools.t3code" },
    key: `t3:${T3_THREAD}`,
  });
  const { __CFBundleIdentifier: _, ...withoutApp } = t3Env(t3);
  expect((await resolveTarget(stopInput(), withoutApp, spawnRunner))?.action).toBeUndefined();
});

test("prefers the T3 thread over the Herdr pane a T3 server inherited", async () => {
  const t3 = await fakeT3("Thread");
  const herdr = await script("herdr", "exit 1");
  const target = await resolveTarget(stopInput(), t3Env(t3, herdrEnv(herdr)), spawnRunner);
  expect(target?.key).toBe(`t3:${T3_THREAD}`);
  expect(target?.action).toEqual({ kind: "open", url: T3_APP_LINK });
});

test("pushes a card titled with the workspace label that shows the final message", async () => {
  await fakeSidebar();
  const herdr = await fakeHerdr("sidebar");
  const env = herdrEnv(herdr);
  expect(await runStop("claude", stopInput(), env, spawnRunner)).toBe(true);
  expect(await pushedArguments()).toEqual([
    "notification",
    "push",
    "--title",
    "sidebar",
    "--body",
    "Release **v0.0.1** is out.",
    "",
    "Next: install it.",
    "--markdown",
    "--icon",
    "claude",
    "--run",
    buildFocusCommand(env) ?? "",
    "--key",
    "herdr:w2Y:p1",
  ]);
});

test("titles the card with the project folder when Herdr has no workspace label", async () => {
  await fakeSidebar();
  const herdr = await fakeHerdr();
  expect(await runStop("codex", stopInput(), herdrEnv(herdr), spawnRunner)).toBe(true);
  expect((await pushedArguments()).slice(2, 4)).toEqual(["--title", "aerospace-sidebar"]);
});

test("pushes without --key to a CLI that predates it, keeping the markdown", async () => {
  await fakeSidebar(0, ["--key"]);
  const herdr = await fakeHerdr();
  expect(await runStop("claude", stopInput(), herdrEnv(herdr), spawnRunner)).toBe(true);
  const pushed = await pushedArguments();
  expect(pushed).toContain("--markdown");
  expect(pushed).not.toContain("--key");
});

test("pushes the message as plain text to a CLI without --key or --markdown", async () => {
  await fakeSidebar(0, ["--key", "--markdown"]);
  const herdr = await fakeHerdr();
  expect(await runStop("claude", stopInput(), herdrEnv(herdr), spawnRunner)).toBe(true);
  const pushed = await pushedArguments();
  expect(pushed).toContain("--body");
  expect(pushed).not.toContain("--markdown");
  expect(pushed).not.toContain("--key");
});

test("stops retrying once a usage error has no option left to blame", async () => {
  await fakeSidebar(64);
  const herdr = await fakeHerdr();
  expect(await runStop("claude", stopInput({ last_assistant_message: null }), herdrEnv(herdr), spawnRunner)).toBe(
    false,
  );
  // With a key, then without; without a message there is no --markdown to leave out as well.
  expect((await pushedArguments()).filter((argument) => argument === "push")).toHaveLength(2);
});

test("does nothing outside Herdr and T3 or without the sidebar CLI", async () => {
  const unused: Runner = async () => {
    throw new Error("must not run");
  };
  expect(await runStop("claude", stopInput(), herdrEnv("herdr"), unused)).toBe(true);
  expect(await runStop("claude", stopInput(), t3Env("t3"), unused)).toBe(true);
  await fakeSidebar();
  expect(await runStop("claude", stopInput(), { PATH: bin }, unused)).toBe(true);
  expect(await Bun.file(pushLog).exists()).toBe(false);
});

test("reports a failed push", async () => {
  await fakeSidebar(1);
  expect(await runStop("claude", stopInput(), herdrEnv(await fakeHerdr()), spawnRunner)).toBe(false);
});

test("pushes nothing for Herdr variables inherited from a pane that does not run the hook", async () => {
  await fakeSidebar();
  // The pane is gone.
  expect(await runStop("codex", stopInput(), herdrEnv(await script("herdr", "exit 1")), spawnRunner)).toBe(true);
  // The pane runs some other process tree.
  const elsewhere = JSON.stringify({ result: { process_info: { shell_pid: 2147483646 } } });
  const herdr = await script("herdr", `printf '%s' '${elsewhere}'`);
  expect(await runStop("codex", stopInput(), herdrEnv(herdr), spawnRunner)).toBe(true);
  expect(await Bun.file(pushLog).exists()).toBe(false);
});

test("pushes a card for a T3 Codex subagent's own thread, found from its rollout", async () => {
  await fakeSidebar();
  const t3 = await fakeT3("Docs review");
  const source = { subagent: { thread_spawn: { parent_thread_id: "root" } } };
  const input = await codexStopInput({ id: "01a1b099", originator: "T3 Code", source });
  const { T3CODE_THREAD_ID: _, ...env } = { ...herdrEnv(await fakeHerdr()), ...t3Env(t3) };
  expect(await runStop("codex", input, env, spawnRunner)).toBe(true);
  const subagent = "thread:provider:codex:native-thread:01a1b099";
  expect(await readFile(join(bin, "t3.log"), "utf8")).toBe(`thread show ${subagent} --json --messages 0 `);
  const pushed = await pushedArguments();
  expect(pushed.slice(2, 4)).toEqual(["--title", "Docs review"]);
  expect(pushed.slice(-2)).toEqual(["--key", `t3:${subagent}`]);
});

test("brings T3 forward for a top-level T3 Codex thread, whose id only T3 knows", async () => {
  const input = await codexStopInput({ id: "01a1b696", originator: "T3 Code", source: "vscode" });
  const unused: Runner = async () => {
    throw new Error("must not run");
  };
  const { T3CODE_THREAD_ID: _, ...env } = { ...herdrEnv("herdr"), ...t3Env("t3") };
  expect(await resolveTarget(input, env, unused)).toEqual({
    title: "aerospace-sidebar",
    action: { kind: "run", command: "open -b com.t3tools.t3code" },
    key: "t3:codex:01a1b696",
  });
});

test("runs as a hook process", async () => {
  await fakeSidebar();
  const herdr = await fakeHerdr();
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
  expect(await pushedArguments()).toContain("Release **v0.0.1** is out.");

  const missingAgent = await run([], herdrEnv(herdr));
  expect(missingAgent.code).toBe(1);
  expect(missingAgent.stderr).toContain("expected the agent");

  await fakeSidebar(1);
  const failed = await run(["codex"], herdrEnv(herdr));
  expect(failed.code).toBe(1);
  expect(failed.stderr).toContain("push failed");
});
