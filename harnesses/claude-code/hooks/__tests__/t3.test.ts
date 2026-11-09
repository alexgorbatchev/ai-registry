import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { factory_testDirectory } from "./fixtures";
import type { Runner } from "../herdr";
import {
  codexSubagentThreadId,
  readCodexT3Session,
  readT3Thread,
  resolveT3Session,
  T3_CODEX_ORIGINATOR,
  t3AppLink,
} from "../t3";

const HOSTED = "https://app.t3.codes/threads/ded656bc-3e4c-42b3-be26-65fb25c7f480/ab49f601-7254";
const APP = "t3code://threads/ded656bc-3e4c-42b3-be26-65fb25c7f480/ab49f601-7254";

const T3 = { T3CODE_THREAD_ID: "ab49f601-7254", T3CODE_CLI_PATH: "/home/me/.t3/bin/t3" };

const CODEX_ID = "01a1b099-04c7-7140-be19-a858d1ed4cf4";

/** Answer `t3 thread show` with `thread`, recording every call. */
function threadRunner(thread: unknown, calls: string[][] = []): Runner {
  return async (argv) => {
    calls.push(argv);
    return JSON.stringify({ thread, messages: [] });
  };
}

/** Write a Codex rollout that opens with `firstLine`, followed by a turn, and return hook input naming it. */
async function codexInput(firstLine: string): Promise<string> {
  const path = join(factory_testDirectory("t3-rollout"), "rollout.jsonl");
  await writeFile(path, `${firstLine}\n{"type":"turn_context","payload":{}}\n`);
  return JSON.stringify({ hook_event_name: "UserPromptSubmit", session_id: "root", transcript_path: path });
}

function sessionMeta(payload: Record<string, unknown>): string {
  return JSON.stringify({ timestamp: "2026-11-09T00:00:00Z", type: "session_meta", payload });
}

test("turns a hosted thread link into the desktop app's link", () => {
  expect(t3AppLink(HOSTED)).toBe(APP);
  expect(t3AppLink(`${HOSTED}/`)).toBe(APP);
  expect(t3AppLink("https://app.t3.codes/threads/only-one")).toBeUndefined();
  expect(t3AppLink("https://app.t3.codes/new")).toBeUndefined();
  expect(t3AppLink("not a url")).toBeUndefined();
});

test("reads a thread through the CLI T3 names", async () => {
  const calls: string[][] = [];
  expect(await readT3Thread("ab49f601-7254", T3, threadRunner({ title: "  Fix hooks ", link: HOSTED }, calls))).toEqual(
    { title: "Fix hooks", appLink: APP },
  );
  expect(calls).toEqual([["/home/me/.t3/bin/t3", "thread", "show", "ab49f601-7254", "--json", "--messages", "0"]]);
});

test("falls back to t3 on PATH and keeps a thread missing its title or link", async () => {
  const calls: string[][] = [];
  expect(await readT3Thread("x", {}, threadRunner({ title: " " }, calls))).toEqual({
    title: undefined,
    appLink: undefined,
  });
  expect(calls[0]?.[0]).toBe("t3");
});

test("reads no thread when the server cannot supply one", async () => {
  expect(await readT3Thread("x", T3, async () => undefined)).toBeUndefined();
  expect(await readT3Thread("x", T3, async () => "not json")).toBeUndefined();
  expect(await readT3Thread("x", T3, threadRunner(null))).toBeUndefined();
  expect(await readT3Thread("x", T3, async () => "{}")).toBeUndefined();
});

test("takes a Claude session's thread from T3's environment, letting T3 resolve the caller", async () => {
  expect(await resolveT3Session("{}", T3)).toEqual({
    threadId: T3.T3CODE_THREAD_ID,
    toolThreadId: undefined,
    key: T3.T3CODE_THREAD_ID,
  });
});

test("finds a top-level Codex thread started by T3, whose id only T3 knows", async () => {
  const input = await codexInput(sessionMeta({ id: CODEX_ID, originator: T3_CODEX_ORIGINATOR, source: "vscode" }));
  expect(await resolveT3Session(input, {})).toEqual({
    threadId: undefined,
    toolThreadId: undefined,
    key: `codex:${CODEX_ID}`,
  });
});

test("names a native Codex subagent's own T3 thread so the rename does not reach its parent", async () => {
  const source = { subagent: { thread_spawn: { parent_thread_id: "root", agent_path: "/root/docs" } } };
  const input = await codexInput(sessionMeta({ id: CODEX_ID, originator: T3_CODEX_ORIGINATOR, source }));
  const threadId = `thread:provider:codex:native-thread:${CODEX_ID}`;
  expect(codexSubagentThreadId(CODEX_ID)).toBe(threadId);
  expect(await readCodexT3Session(input)).toEqual({ threadId, toolThreadId: threadId, key: threadId });
});

test("finds no T3 thread for Codex sessions T3 did not start or cannot mirror", async () => {
  const outsideT3 = await codexInput(sessionMeta({ id: CODEX_ID, originator: "codex-tui", source: "cli" }));
  expect(await resolveT3Session(outsideT3, {})).toBeUndefined();
  const review = await codexInput(
    sessionMeta({ id: CODEX_ID, originator: T3_CODEX_ORIGINATOR, source: { subagent: "review" } }),
  );
  expect(await readCodexT3Session(review)).toBeUndefined();
  expect(await readCodexT3Session(await codexInput(sessionMeta({ originator: T3_CODEX_ORIGINATOR })))).toBeUndefined();
  expect(await readCodexT3Session(await codexInput(sessionMeta({ id: CODEX_ID })))).toBeUndefined();
  expect(await readCodexT3Session(await codexInput('{"type":"turn_context","payload":{}}'))).toBeUndefined();
  expect(await readCodexT3Session(await codexInput('{"type":"session_meta"}'))).toBeUndefined();
  expect(await readCodexT3Session(await codexInput("not json"))).toBeUndefined();
});

test("finds no T3 thread without a readable rollout", async () => {
  expect(await resolveT3Session("{}", {})).toBeUndefined();
  expect(await readCodexT3Session("not json")).toBeUndefined();
  expect(await readCodexT3Session(JSON.stringify({ transcript_path: null }))).toBeUndefined();
  expect(await readCodexT3Session(JSON.stringify({ transcript_path: "/nonexistent/rollout.jsonl" }))).toBeUndefined();
  const empty = join(factory_testDirectory("t3-rollout"), "empty.jsonl");
  await writeFile(empty, "");
  expect(await readCodexT3Session(JSON.stringify({ transcript_path: empty }))).toBeUndefined();
});
