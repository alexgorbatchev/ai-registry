import { expect, test } from "bun:test";
import { projectName, readProject, readWorkspaceLabel, type Runner, spawnRunner } from "../herdr";

const HERDR = { HERDR_WORKSPACE_ID: "w2J", HERDR_BIN_PATH: "/opt/herdr dir/herdr" };

const INPUT = JSON.stringify({ hook_event_name: "Stop", cwd: "/src/repos/dotfiles-cli" });

/** Answer `herdr workspace get` with the given label, recording every call. */
function workspaceRunner(label: unknown, calls: string[][] = []): Runner {
  return async (argv) => {
    calls.push(argv);
    return JSON.stringify({ result: { workspace: { label } } });
  };
}

const failingRunner: Runner = async () => undefined;

test("names the project from the hook input's cwd", () => {
  expect(projectName(INPUT)).toBe("dotfiles-cli");
  expect(projectName("{}")).toBeUndefined();
  expect(projectName("")).toBeUndefined();
});

test("reads the workspace label through the configured herdr binary", async () => {
  const calls: string[][] = [];
  expect(await readWorkspaceLabel(HERDR, workspaceRunner("  dotfiles ", calls))).toBe("dotfiles");
  expect(calls).toEqual([["/opt/herdr dir/herdr", "workspace", "get", "w2J"]]);
});

test("reports no workspace label when herdr cannot supply one", async () => {
  expect(await readWorkspaceLabel({}, workspaceRunner("dotfiles"))).toBeUndefined();
  expect(await readWorkspaceLabel(HERDR, failingRunner)).toBeUndefined();
  expect(await readWorkspaceLabel(HERDR, async () => "not json")).toBeUndefined();
  expect(await readWorkspaceLabel(HERDR, workspaceRunner(" "))).toBeUndefined();
  expect(await readWorkspaceLabel(HERDR, workspaceRunner(42))).toBeUndefined();
});

test("prefers the workspace label over the session folder", async () => {
  expect(await readProject(INPUT, HERDR, workspaceRunner("dotfiles"))).toBe("dotfiles");
  expect(await readProject(INPUT, HERDR, failingRunner)).toBe("dotfiles-cli");
});

test("returns stdout only for commands that succeed", async () => {
  const env = { PATH: process.env.PATH ?? "" };
  expect(await spawnRunner(["/bin/sh", "-c", "printf ok"], env)).toBe("ok");
  expect(await spawnRunner(["/bin/sh", "-c", "exit 3"], env)).toBeUndefined();
  expect(await spawnRunner(["/nonexistent/binary"], env)).toBeUndefined();
});
