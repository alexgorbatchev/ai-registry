import { quote } from "shell-quote";
import {
  type Environment,
  projectName,
  readProject,
  type Runner,
  spawnRunner,
  spawnWithStatus,
  type StatusRunner,
} from "./herdr";
import { readT3Thread } from "./t3";

const SIDEBAR_CLI = "aerospace-sidebar";

const AGENT_NAMES = { claude: "Claude", codex: "Codex" } as const;

/** Characters of the agent's final message a card shows. */
export const MAX_BODY_LENGTH = 300;

/** The exit status of an `aerospace-sidebar` that does not know an option, such as one older than `--markdown`. */
const USAGE_ERROR = 64;

/**
 * The options a push tries, most first. A CLI older than one refuses it with a usage error, and the push goes
 * again without it: `--key` came after `--markdown`, so it goes first.
 */
const PUSH_ATTEMPTS = [
  { key: true, markdown: true },
  { key: false, markdown: true },
  { key: false, markdown: false },
] as const;

export type Agent = keyof typeof AGENT_NAMES;

/** What clicking a card does: run a shell command, or open a URL. */
export type CardAction = { kind: "run"; command: string } | { kind: "open"; url: string };

/** Where a card points: its title, its click action, and the key that keeps one card per pane or thread. */
export type CardTarget = {
  title: string | undefined;
  action: CardAction | undefined;
  key: string;
};

export function parseAgent(value: string | undefined): Agent | undefined {
  return value !== undefined && Object.hasOwn(AGENT_NAMES, value) ? (value as Agent) : undefined;
}

/**
 * Build the click command: focus the agent's Herdr pane, then bring its terminal app
 * forward. The sidebar runs it in a login shell without Herdr variables, so the
 * binary and socket are written literally.
 */
export function buildFocusCommand(env: Environment): string | undefined {
  const paneId = env.HERDR_PANE_ID;
  if (!paneId) return undefined;
  const socket = env.HERDR_SOCKET_PATH ? [`HERDR_SOCKET_PATH=${quote([env.HERDR_SOCKET_PATH])}`] : [];
  const focus = [...socket, quote([env.HERDR_BIN_PATH || "herdr", "agent", "focus", paneId])].join(" ");
  const terminal = env.__CFBundleIdentifier;
  return terminal ? `${focus}; ${quote(["open", "-b", terminal])}` : focus;
}

/**
 * The agent's final message from the Stop input's `last_assistant_message`, as markdown with its line breaks
 * (at most one blank line in a row), cut to `MAX_BODY_LENGTH` characters where no markdown span is left open.
 */
export function finalMessage(input: string): string | undefined {
  let message: unknown;
  try {
    message = JSON.parse(input)?.last_assistant_message;
  } catch {
    return undefined;
  }
  if (typeof message !== "string") return undefined;
  const text = message
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return undefined;
  const characters = [...new Intl.Segmenter().segment(text)].map(({ segment }) => segment);
  if (characters.length <= MAX_BODY_LENGTH) return text;
  return `${closedMarkdown(characters.slice(0, MAX_BODY_LENGTH - 1).join("")).trimEnd()}…`;
}

/** Emphasis and strikethrough markers, longest first, as markdown pairs them. */
const MARKERS = ["**", "~~", "*", "_"];

/**
 * `text`, the start of a longer markdown message, cut back until it ends with no span open: no link without its
 * `](url)`, no code span without its closing backtick, and no emphasis or strikethrough marker without its pair.
 */
export function closedMarkdown(text: string): string {
  let cut = text;
  for (;;) {
    const next = cutOpenSpan(cut);
    if (next === cut) return cut;
    cut = next;
  }
}

/** `text` cut before the last span it leaves open, or `text` itself when it leaves none open. */
function cutOpenSpan(text: string): string {
  // A link starts at `[` and ends with `)`; one started after the last complete link is cut off.
  const lastLinkEnd = [...text.matchAll(/\[[^\]]*\]\([^)]*\)/g)].reduce(
    (_, match) => (match.index ?? 0) + match[0].length,
    0,
  );
  const openLink = text.indexOf("[", lastLinkEnd);
  if (openLink >= 0) return text.slice(0, openLink);
  const ticks = [...text.matchAll(/`/g)];
  if (ticks.length % 2 === 1) return text.slice(0, ticks.at(-1)?.index);
  // Markers inside code spans are text; a `_` between two letters or digits is part of a word.
  let rest = text.replace(/`[^`]*`/g, (span) => " ".repeat(span.length));
  for (const marker of MARKERS) {
    const positions: number[] = [];
    for (let index = rest.indexOf(marker); index >= 0; index = rest.indexOf(marker, index + marker.length)) {
      const intraword = marker === "_" && /\w/.test(rest[index - 1] ?? "") && /\w/.test(rest[index + 1] ?? "");
      if (!intraword) positions.push(index);
    }
    if (positions.length % 2 === 1) return text.slice(0, positions.at(-1));
    // A pair is settled; blank it so `*` does not count the stars of `**`.
    for (const index of positions)
      rest = rest.slice(0, index) + " ".repeat(marker.length) + rest.slice(index + marker.length);
  }
  return text;
}

export function buildPushArguments(options: {
  agent: Agent;
  title: string | undefined;
  action: CardAction | undefined;
  message: string | undefined;
  markdown: boolean;
  key?: string;
}): string[] {
  const body = options.message ? ["--body", options.message, ...(options.markdown ? ["--markdown"] : [])] : [];
  const action = options.action
    ? options.action.kind === "run"
      ? ["--run", options.action.command]
      : ["--open", options.action.url]
    : [];
  return [
    "notification",
    "push",
    "--title",
    options.title ?? AGENT_NAMES[options.agent],
    ...body,
    "--icon",
    options.agent,
    ...action,
    ...(options.key ? ["--key", options.key] : []),
  ];
}

/**
 * The card for a T3 Code thread (`T3CODE_THREAD_ID`): titled with the thread's title, else the session folder, and
 * opening the thread in the app through its `t3code://` link. When the T3 server does not answer, a click brings
 * the app (`__CFBundleIdentifier`) forward instead.
 */
async function t3Target(threadId: string, input: string, env: Environment, run: Runner): Promise<CardTarget> {
  const thread = await readT3Thread(env, run);
  const app = env.__CFBundleIdentifier;
  const action: CardAction | undefined = thread?.appLink
    ? { kind: "open", url: thread.appLink }
    : app
      ? { kind: "run", command: quote(["open", "-b", app]) }
      : undefined;
  return { title: thread?.title ?? projectName(input), action, key: `t3:${threadId}` };
}

/**
 * The card for a Herdr pane (`HERDR_PANE_ID`): titled with the project, focusing the pane on click, keyed to the
 * pane. Undefined outside Herdr.
 */
async function herdrTarget(input: string, env: Environment, run: Runner): Promise<CardTarget | undefined> {
  const focusCommand = buildFocusCommand(env);
  if (focusCommand === undefined) return undefined;
  return {
    title: await readProject(input, env, run),
    action: { kind: "run", command: focusCommand },
    key: `herdr:${env.HERDR_PANE_ID ?? ""}`,
  };
}

/**
 * Where the session's card points. A T3 Code thread wins over a Herdr pane, because a T3 server started from a
 * Herdr pane passes that pane's variables on to every thread it runs.
 */
export async function resolveTarget(input: string, env: Environment, run: Runner): Promise<CardTarget | undefined> {
  const threadId = env.T3CODE_THREAD_ID;
  return threadId ? t3Target(threadId, input, env, run) : herdrTarget(input, env, run);
}

/**
 * Push a sidebar card when the agent's turn ends in a T3 Code thread or a Herdr pane (`resolveTarget`), with the
 * agent's final message as its markdown body, keyed so each thread or pane keeps one card. Anywhere else, or
 * without the sidebar CLI on PATH, it does nothing. A CLI too old for `--key` or `--markdown` gets the push without
 * them (`PUSH_ATTEMPTS`). Returns false when the push failed.
 */
export async function runStop(
  agent: Agent,
  input: string,
  env: Environment,
  run: Runner,
  push: StatusRunner = spawnWithStatus,
): Promise<boolean> {
  const sidebar = Bun.which(SIDEBAR_CLI, { PATH: env.PATH ?? "" });
  if (sidebar === null) return true;
  const target = await resolveTarget(input, env, run);
  if (target === undefined) return true;
  const message = finalMessage(input);
  let status: number | undefined;
  let previous: string[] = [];
  for (const attempt of PUSH_ATTEMPTS) {
    const args = buildPushArguments({
      agent,
      title: target.title,
      action: target.action,
      message,
      markdown: attempt.markdown,
      key: attempt.key ? target.key : undefined,
    });
    // Without a message there is no --markdown to leave out, so the last attempt would repeat the one before.
    if (args.join("\0") === previous.join("\0")) continue;
    previous = args;
    status = (await push([sidebar, ...args], env)).status;
    if (status !== USAGE_ERROR) break;
  }
  return status === 0;
}

if (import.meta.main) {
  const agent = parseAgent(process.argv[2]);
  // The harness writes the hook input to stdin; drain it so the write never fails.
  const input = await Bun.stdin.text();
  if (agent === undefined) {
    console.error(`turnNotification: expected the agent (${Object.keys(AGENT_NAMES).join(" or ")}) as argument`);
    process.exit(1);
  }
  if (!(await runStop(agent, input, process.env, spawnRunner))) {
    console.error(`turnNotification: ${SIDEBAR_CLI} notification push failed`);
    process.exit(1);
  }
}
