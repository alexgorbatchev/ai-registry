import { expect, test } from "bun:test";
import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "shell-quote";
import { factory_testDirectory } from "./fixtures";
import type { Runner } from "../herdr";
import {
  buildHerdrRecapInstruction,
  buildRecapCommand,
  buildT3RecapInstruction,
  runUserPromptSubmit,
} from "../recapTitle";

const HOOK = join(import.meta.dir, "..", "recapTitle.ts");

const HERDR = {
  HERDR_PANE_ID: "w2J:pE",
  HERDR_WORKSPACE_ID: "w2J",
  HERDR_BIN_PATH: "/opt/herdr dir/herdr",
  HERDR_SOCKET_PATH: "/home/me/.config/herdr/herdr.sock",
};

const INPUT = JSON.stringify({ hook_event_name: "UserPromptSubmit", cwd: "/src/repos/dotfiles-cli", prompt: "hi" });

/** The hook's pid in these tests, run by a harness (200) in the pane's shell (100). */
const HOOK_PID = 300;
const PS_OUTPUT = "  1     0\n100     1\n200   100\n300   200\n";

/**
 * Answer Herdr and `ps` the way a pane whose shell is `shellPid` does, with the given workspace label, recording every
 * call. A `shellPid` of null is a pane Herdr no longer has.
 */
function herdrRunner(label: unknown, calls: string[][] = [], shellPid: number | null = 100): Runner {
  return async (argv) => {
    calls.push(argv);
    if (argv[0] === "ps") return PS_OUTPUT;
    if (argv[1] === "pane") {
      return shellPid === null ? undefined : JSON.stringify({ result: { process_info: { shell_pid: shellPid } } });
    }
    return JSON.stringify({ result: { workspace: { label } } });
  };
}

/** Fill in the recap the way the agent is told to, then split it as a shell would. */
function runAsAgent(command: string, recap: string): ReturnType<typeof parse> {
  return parse(command.replace("<recap>", recap));
}

const T3 = { T3CODE_THREAD_ID: "ab49f601-7254" };
const T3_SESSION = { threadId: T3.T3CODE_THREAD_ID, toolThreadId: undefined, key: T3.T3CODE_THREAD_ID };

test("injects nothing outside a Herdr pane or T3 thread", async () => {
  const calls: string[][] = [];
  expect(await runUserPromptSubmit(INPUT, {}, herdrRunner("dotfiles", calls), HOOK_PID)).toBe("");
  expect(await runUserPromptSubmit(INPUT, { HERDR_PANE_ID: "" }, herdrRunner("dotfiles", calls), HOOK_PID)).toBe("");
  expect(await runUserPromptSubmit(INPUT, { T3CODE_THREAD_ID: "" }, herdrRunner("dotfiles", calls), HOOK_PID)).toBe("");
  expect(calls).toEqual([]);
});

test("injects nothing for Herdr variables inherited from a pane that does not run the hook", async () => {
  // A long-lived server keeps the variables of the pane it started in, after that pane has closed or moved on.
  expect(await runUserPromptSubmit(INPUT, HERDR, herdrRunner("dotfiles", [], null), HOOK_PID)).toBe("");
  expect(await runUserPromptSubmit(INPUT, HERDR, herdrRunner("dotfiles", [], 999), HOOK_PID)).toBe("");
  const noPs: Runner = async (argv) => (argv[0] === "ps" ? undefined : herdrRunner("dotfiles")(argv, HERDR));
  expect(await runUserPromptSubmit(INPUT, HERDR, noPs, HOOK_PID)).toBe("");
  const looped: Runner = async (argv) => (argv[0] === "ps" ? "300 200\n200 300\n" : herdrRunner("x")(argv, HERDR));
  expect(await runUserPromptSubmit(INPUT, HERDR, looped, HOOK_PID)).toBe("");
});

test("asks Herdr about the session's own pane through the configured binary", async () => {
  const calls: string[][] = [];
  await runUserPromptSubmit(INPUT, HERDR, herdrRunner("dotfiles", calls), HOOK_PID);
  expect(calls.slice(0, 2)).toEqual([
    ["/opt/herdr dir/herdr", "pane", "process-info", "--pane", "w2J:pE"],
    ["ps", "-A", "-o", "pid=", "-o", "ppid="],
  ]);
});

test("tells the agent to rename the T3 thread with T3's tool, without the project", () => {
  const instruction = buildT3RecapInstruction(T3_SESSION);
  expect(instruction).toContain("T3 Code thread ab49f601-7254");
  expect(instruction).toContain("`t3_thread_update`");
  expect(instruction).toContain("`action` set to `rename`");
  expect(instruction).toContain("`threadId` left out so it renames this thread");
  expect(instruction).toContain("at most 60 characters");
  expect(instruction).toContain("do not start the title with the project, repository, or folder name");
  expect(instruction).not.toContain("herdr");
});

test("names the thread to rename when T3 cannot tell the caller, and omits an id it does not know", () => {
  const subagent = "thread:provider:codex:native-thread:01a1b099";
  const named = buildT3RecapInstruction({ threadId: subagent, toolThreadId: subagent, key: subagent });
  expect(named).toContain(`\`threadId\` set to \`${subagent}\``);
  expect(named).not.toContain("left out");
  const unnamed = buildT3RecapInstruction({ threadId: undefined, toolThreadId: undefined, key: "codex:01a1" });
  expect(unnamed).toContain("This session runs in a T3 Code thread.");
  expect(unnamed).toContain("`threadId` left out");
});

test("retitles a T3 Codex thread found from its rollout instead of the inherited Herdr pane", async () => {
  const path = join(factory_testDirectory("recap-rollout"), "rollout.jsonl");
  const meta = { id: "01a1b696", originator: "T3 Code", source: "vscode" };
  await writeFile(path, `${JSON.stringify({ type: "session_meta", payload: meta })}\n`);
  const calls: string[][] = [];
  const input = JSON.stringify({ hook_event_name: "UserPromptSubmit", transcript_path: path, prompt: "hi" });
  const output = JSON.parse(await runUserPromptSubmit(input, HERDR, herdrRunner("dotfiles", calls), HOOK_PID));
  expect(output.hookSpecificOutput.additionalContext).toBe(
    buildT3RecapInstruction({ threadId: undefined, toolThreadId: undefined, key: "codex:01a1b696" }),
  );
  expect(calls).toEqual([]);
});

test("prefers the T3 thread over the Herdr pane a T3 server inherited, without asking Herdr", async () => {
  const calls: string[][] = [];
  const output = JSON.parse(
    await runUserPromptSubmit(INPUT, { ...HERDR, ...T3 }, herdrRunner("dotfiles", calls), HOOK_PID),
  );
  expect(output.hookSpecificOutput).toEqual({
    hookEventName: "UserPromptSubmit",
    additionalContext: buildT3RecapInstruction(T3_SESSION),
  });
  expect(calls).toEqual([]);
});

test("titles the pane with the project followed by the recap", () => {
  const command = buildRecapCommand(HERDR, "dotfiles");
  expect(runAsAgent(command ?? "", "fix pane naming")).toEqual([
    "HERDR_SOCKET_PATH=/home/me/.config/herdr/herdr.sock",
    "/opt/herdr dir/herdr",
    "pane",
    "report-metadata",
    "w2J:pE",
    "--source",
    "recap",
    "--title",
    "dotfiles: fix pane naming",
  ]);
});

test("keeps the title quoting intact for projects containing quotes", () => {
  const command = buildRecapCommand(HERDR, "it's mine");
  expect(runAsAgent(command ?? "", "x").at(-1)).toBe("its mine: x");
});

test("falls back to herdr on PATH, its default socket, and a bare recap", () => {
  const command = buildRecapCommand({ HERDR_PANE_ID: "p1" }, undefined);
  expect(runAsAgent(command ?? "", "x")).toEqual([
    "herdr",
    "pane",
    "report-metadata",
    "p1",
    "--source",
    "recap",
    "--title",
    "x",
  ]);
  expect(buildHerdrRecapInstruction({ HERDR_PANE_ID: "p1" }, undefined)).not.toContain("project name");
});

test("names the workspace label as the project", async () => {
  const output = JSON.parse(await runUserPromptSubmit(INPUT, HERDR, herdrRunner("dotfiles"), HOOK_PID));
  expect(output.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
  expect(output.hookSpecificOutput.additionalContext).toBe(buildHerdrRecapInstruction(HERDR, "dotfiles"));
  expect(output.hookSpecificOutput.additionalContext).toContain(buildRecapCommand(HERDR, "dotfiles"));
  expect(output.hookSpecificOutput.additionalContext).toContain("do not repeat it in the recap");
});

test("names the session directory when the workspace label is unavailable", async () => {
  const noLabel: Runner = async (argv) => (argv[1] === "workspace" ? undefined : herdrRunner("x")(argv, HERDR));
  const output = JSON.parse(await runUserPromptSubmit(INPUT, HERDR, noLabel, HOOK_PID));
  expect(output.hookSpecificOutput.additionalContext).toContain("--title 'dotfiles-cli: <recap>'");
});

test("runs as a hook process, draining the harness input", async () => {
  const run = async (env: Record<string, string>) => {
    const child = Bun.spawn(["bun", HOOK], {
      env: { PATH: process.env.PATH ?? "", ...env },
      stdin: "pipe",
      stdout: "pipe",
    });
    child.stdin.write(INPUT);
    child.stdin.end();
    const stdout = await new Response(child.stdout).text();
    return { code: await child.exited, stdout };
  };
  expect(await run({})).toEqual({ code: 0, stdout: "" });
  expect(JSON.parse((await run(T3)).stdout).hookSpecificOutput.additionalContext).toBe(
    buildT3RecapInstruction(T3_SESSION),
  );
  // This test process starts the hook, so a pane whose shell it is runs the hook. Herdr has no workspace label for
  // it, so the directory names the project.
  const herdr = join(factory_testDirectory("recap-herdr"), "herdr");
  const processInfo = JSON.stringify({ result: { process_info: { shell_pid: process.pid } } });
  await writeFile(herdr, `#!/bin/sh\n[ "$2" = process-info ] && printf '%s' '${processInfo}' && exit 0\nexit 1\n`);
  await chmod(herdr, 0o755);
  const env = { ...HERDR, HERDR_BIN_PATH: herdr };
  const inPane = await run(env);
  expect(inPane.code).toBe(0);
  expect(JSON.parse(inPane.stdout).hookSpecificOutput.additionalContext).toBe(
    buildHerdrRecapInstruction(env, "dotfiles-cli"),
  );
  // The pane the variables name is gone.
  expect(await run(HERDR)).toEqual({ code: 0, stdout: "" });
});
