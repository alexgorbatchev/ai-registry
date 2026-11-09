import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { Environment, Runner } from "./herdr";

/** What the T3 Code server reports about the thread a session runs in. */
export type T3Thread = {
  /** The thread's title in the T3 sidebar, when it has one. */
  title: string | undefined;
  /** A `t3code://` link that opens the thread in the desktop app. */
  appLink: string | undefined;
};

/**
 * The T3 Code thread a hook's session runs in.
 *
 * Claude Code runs one process per thread, so T3 names the thread in `T3CODE_THREAD_ID`. Codex runs every T3 thread
 * in one shared app-server, whose environment names none of them; the hook finds the thread from the session's
 * rollout instead (`readCodexT3Session`).
 */
export type T3Session = {
  /** The T3 thread id, when the hook can name it. A top-level Codex thread's id is known only to T3. */
  threadId: string | undefined;
  /**
   * The id an agent passes as `threadId` to T3's thread tools. Undefined when T3 resolves the calling thread itself,
   * which a native Codex subagent cannot rely on: it shares its parent's MCP connection.
   */
  toolThreadId: string | undefined;
  /** A key that stays the same for the thread across turns. */
  key: string;
};

/** The `originator` T3 Code stamps on the Codex sessions it starts. */
export const T3_CODEX_ORIGINATOR = "T3 Code";

/** T3's id for the thread that mirrors a native Codex subagent, by the subagent's own Codex thread id. */
export function codexSubagentThreadId(nativeId: string): string {
  return `thread:provider:codex:native-thread:${nativeId}`;
}

/** The thread path of T3's hosted links, `/threads/<environment>/<thread>`, which its app links share. */
const HOSTED_THREAD_PATH = /^\/threads\/([^/]+)\/([^/]+)\/?$/;

/**
 * Turn a thread's hosted link (`https://app.t3.codes/threads/<environment>/<thread>`) into the desktop app's own
 * link, `t3code://threads/<environment>/<thread>`, which macOS hands to the app instead of a browser.
 */
export function t3AppLink(hostedLink: string): string | undefined {
  if (!URL.canParse(hostedLink)) return undefined;
  const match = HOSTED_THREAD_PATH.exec(new URL(hostedLink).pathname);
  return match ? `t3code://threads/${match[1]}/${match[2]}` : undefined;
}

/** The first line of a file, or undefined when it cannot be read. Rollouts grow large, so only that line is read. */
async function readFirstLine(path: string): Promise<string | undefined> {
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    for await (const line of lines) return line;
    return undefined;
  } catch {
    return undefined;
  } finally {
    lines.close();
    stream.destroy();
  }
}

/**
 * The T3 session of a Codex hook, from the `session_meta` record that opens the rollout named by the hook input's
 * `transcript_path`: T3 starts the session when its `originator` is `T3_CODEX_ORIGINATOR`. A native subagent
 * (`source.subagent.thread_spawn`) is mirrored as its own T3 thread, named after the subagent's Codex thread `id`.
 * Undefined outside T3, for other kinds of Codex subagent, or when the rollout cannot be read.
 */
export async function readCodexT3Session(input: string): Promise<T3Session | undefined> {
  let transcriptPath: unknown;
  try {
    transcriptPath = JSON.parse(input)?.transcript_path;
  } catch {
    return undefined;
  }
  if (typeof transcriptPath !== "string" || !transcriptPath) return undefined;
  const line = await readFirstLine(transcriptPath);
  if (line === undefined) return undefined;
  let meta: unknown;
  try {
    meta = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof meta !== "object" || meta === null || !("type" in meta) || meta.type !== "session_meta") return undefined;
  const payload = "payload" in meta ? meta.payload : undefined;
  if (typeof payload !== "object" || payload === null) return undefined;
  if (!("originator" in payload) || payload.originator !== T3_CODEX_ORIGINATOR) return undefined;
  if (!("id" in payload) || typeof payload.id !== "string" || !payload.id) return undefined;
  const source = "source" in payload ? payload.source : undefined;
  const subagent = typeof source === "object" && source !== null && "subagent" in source ? source.subagent : undefined;
  if (subagent === undefined) return { threadId: undefined, toolThreadId: undefined, key: `codex:${payload.id}` };
  if (typeof subagent !== "object" || subagent === null || !("thread_spawn" in subagent)) return undefined;
  const threadId = codexSubagentThreadId(payload.id);
  return { threadId, toolThreadId: threadId, key: threadId };
}

/** The T3 Code thread the hook's session runs in (`T3Session`), or undefined outside T3. */
export async function resolveT3Session(input: string, env: Environment): Promise<T3Session | undefined> {
  const threadId = env.T3CODE_THREAD_ID;
  if (threadId) return { threadId, toolThreadId: undefined, key: threadId };
  return readCodexT3Session(input);
}

/**
 * Read a T3 Code thread from the running server with `t3 thread show`, through the CLI T3 names in
 * `T3CODE_CLI_PATH`, else `t3` on `PATH`. Undefined when the server does not answer.
 */
export async function readT3Thread(threadId: string, env: Environment, run: Runner): Promise<T3Thread | undefined> {
  const stdout = await run([env.T3CODE_CLI_PATH || "t3", "thread", "show", threadId, "--json", "--messages", "0"], env);
  if (stdout === undefined) return undefined;
  let thread: unknown;
  try {
    thread = JSON.parse(stdout)?.thread;
  } catch {
    return undefined;
  }
  if (typeof thread !== "object" || thread === null) return undefined;
  const title = "title" in thread && typeof thread.title === "string" ? thread.title.trim() : "";
  const link = "link" in thread && typeof thread.link === "string" ? thread.link : "";
  return { title: title || undefined, appLink: t3AppLink(link) };
}
