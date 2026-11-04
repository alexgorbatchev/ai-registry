import { expect, test } from "bun:test";
import { join } from "node:path";
import { parse } from "shell-quote";
import { buildRecapCommand, buildRecapInstruction, runUserPromptSubmit } from "../herdrPaneRecap";

const HOOK = join(import.meta.dir, "..", "herdrPaneRecap.ts");

const HERDR = {
  HERDR_PANE_ID: "w2J:pE",
  HERDR_BIN_PATH: "/opt/herdr dir/herdr",
  HERDR_SOCKET_PATH: "/home/me/.config/herdr/herdr.sock",
};

/** Fill in the recap the way the agent is told to, then split it as a shell would. */
function runAsAgent(command: string, recap: string): ReturnType<typeof parse> {
  return parse(command.replace("<recap>", recap));
}

test("injects nothing outside a Herdr pane", () => {
  expect(runUserPromptSubmit({})).toBe("");
  expect(runUserPromptSubmit({ HERDR_PANE_ID: "", HERDR_SOCKET_PATH: HERDR.HERDR_SOCKET_PATH })).toBe("");
});

test("targets the pane, binary, and socket from the environment", () => {
  const command = buildRecapCommand(HERDR);
  expect(command).toBeDefined();
  expect(runAsAgent(command ?? "", "fix pane naming")).toEqual([
    "HERDR_SOCKET_PATH=/home/me/.config/herdr/herdr.sock",
    "/opt/herdr dir/herdr",
    "pane",
    "report-metadata",
    "w2J:pE",
    "--source",
    "recap",
    "--title",
    "fix pane naming",
  ]);
});

test("falls back to herdr on PATH and its default socket", () => {
  const command = buildRecapCommand({ HERDR_PANE_ID: "p1" });
  expect(runAsAgent(command ?? "", "x")).toEqual(["herdr", "pane", "report-metadata", "p1", "--source", "recap", "--title", "x"]);
});

test("wraps the instruction in UserPromptSubmit additional context", () => {
  const output = JSON.parse(runUserPromptSubmit(HERDR));
  expect(output.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
  expect(output.hookSpecificOutput.additionalContext).toBe(buildRecapInstruction(HERDR));
  expect(output.hookSpecificOutput.additionalContext).toContain(buildRecapCommand(HERDR));
});

test("runs as a hook process, draining the harness input", async () => {
  const run = async (env: Record<string, string>) => {
    const child = Bun.spawn(["bun", HOOK], { env: { PATH: process.env.PATH ?? "", ...env }, stdin: "pipe", stdout: "pipe" });
    child.stdin.write(JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "hi" }));
    child.stdin.end();
    const stdout = await new Response(child.stdout).text();
    return { code: await child.exited, stdout };
  };
  expect(await run({})).toEqual({ code: 0, stdout: "" });
  const inPane = await run(HERDR);
  expect(inPane.code).toBe(0);
  expect(JSON.parse(inPane.stdout).hookSpecificOutput.additionalContext).toBe(buildRecapInstruction(HERDR));
});
