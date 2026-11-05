import type { Environment, Runner } from "./herdr";

/** What the T3 Code server reports about the thread a session runs in. */
export type T3Thread = {
  /** The thread's title in the T3 sidebar, when it has one. */
  title: string | undefined;
  /** A `t3code://` link that opens the thread in the desktop app. */
  appLink: string | undefined;
};

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

/**
 * Read the thread a T3 Code session runs in (`T3CODE_THREAD_ID`) from the running server with
 * `t3 thread show`, through the CLI T3 names in `T3CODE_CLI_PATH`. Undefined outside T3 or when the server
 * does not answer.
 */
export async function readT3Thread(env: Environment, run: Runner): Promise<T3Thread | undefined> {
  const threadId = env.T3CODE_THREAD_ID;
  if (!threadId) return undefined;
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
