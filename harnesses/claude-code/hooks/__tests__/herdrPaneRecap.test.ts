import { expect, test } from "bun:test";
import { join } from "node:path";
import { parse } from "shell-quote";
import type { Runner } from "../herdrTurnNotification";
import { buildRecapCommand, buildRecapInstruction, readWorkspaceLabel, runUserPromptSubmit } from "../herdrPaneRecap";

const HOOK = join(import.meta.dir, "..", "herdrPaneRecap.ts");

const HERDR = {
  HERDR_PANE_ID: "w2J:pE",
  HERDR_WORKSPACE_ID: "w2J",
  HERDR_BIN_PATH: "/opt/herdr dir/herdr",
  HERDR_SOCKET_PATH: "/home/me/.config/herdr/herdr.sock",
};

const INPUT = JSON.stringify({ hook_event_name: "UserPromptSubmit", cwd: "/src/repos/dotfiles-cli", prompt: "hi" });

/** Answer `herdr workspace get` with the given label, recording every call. */
function workspaceRunner(label: unknown, calls: string[][] = []): Runner {
  return async (argv) => {
    calls.push(argv);
    return JSON.stringify({ result: { workspace: { label } } });
  };
}

const failingRunner: Runner = async () => undefined;

/** Fill in the recap the way the agent is told to, then split it as a shell would. */
function runAsAgent(command: string, recap: string): ReturnType<typeof parse> {
  return parse(command.replace("<recap>", recap));
}

test("injects nothing outside a Herdr pane", async () => {
  const calls: string[][] = [];
  expect(await runUserPromptSubmit(INPUT, {}, workspaceRunner("dotfiles", calls))).toBe("");
  expect(await runUserPromptSubmit(INPUT, { HERDR_PANE_ID: "" }, workspaceRunner("dotfiles", calls))).toBe("");
  expect(calls).toEqual([]);
});

test("reads the workspace label through the configured herdr binary", async () => {
  const calls: string[][] = [];
  expect(await readWorkspaceLabel(HERDR, workspaceRunner("  dotfiles ", calls))).toBe("dotfiles");
  expect(calls).toEqual([["/opt/herdr dir/herdr", "workspace", "get", "w2J"]]);
});

test("reports no workspace label when herdr cannot supply one", async () => {
  expect(await readWorkspaceLabel({ HERDR_PANE_ID: "p1" }, workspaceRunner("dotfiles"))).toBeUndefined();
  expect(await readWorkspaceLabel(HERDR, failingRunner)).toBeUndefined();
  expect(await readWorkspaceLabel(HERDR, async () => "not json")).toBeUndefined();
  expect(await readWorkspaceLabel(HERDR, workspaceRunner(" "))).toBeUndefined();
  expect(await readWorkspaceLabel(HERDR, workspaceRunner(42))).toBeUndefined();
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
  expect(buildRecapInstruction({ HERDR_PANE_ID: "p1" }, undefined)).not.toContain("project name");
});

test("names the workspace label as the project", async () => {
  const output = JSON.parse(await runUserPromptSubmit(INPUT, HERDR, workspaceRunner("dotfiles")));
  expect(output.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
  expect(output.hookSpecificOutput.additionalContext).toBe(buildRecapInstruction(HERDR, "dotfiles"));
  expect(output.hookSpecificOutput.additionalContext).toContain(buildRecapCommand(HERDR, "dotfiles"));
  expect(output.hookSpecificOutput.additionalContext).toContain("do not repeat it in the recap");
});

test("names the session directory when the workspace label is unavailable", async () => {
  const output = JSON.parse(await runUserPromptSubmit(INPUT, HERDR, failingRunner));
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
  // The binary does not exist, so the label lookup fails and the directory names the project.
  const inPane = await run(HERDR);
  expect(inPane.code).toBe(0);
  expect(JSON.parse(inPane.stdout).hookSpecificOutput.additionalContext).toBe(
    buildRecapInstruction(HERDR, "dotfiles-cli"),
  );
});
