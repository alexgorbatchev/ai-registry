import { quote } from "shell-quote";
import { type Environment, readProject, type Runner, spawnRunner, spawnWithStatus, type StatusRunner } from "./herdr";

const SIDEBAR_CLI = "aerospace-sidebar";

const AGENT_NAMES = { claude: "Claude", codex: "Codex" } as const;

/** Characters of the agent's final message a card shows. */
export const MAX_BODY_LENGTH = 300;

/** The exit status of an `aerospace-sidebar` that does not know an option, such as one older than `--markdown`. */
const USAGE_ERROR = 64;

export type Agent = keyof typeof AGENT_NAMES;

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
  focusCommand: string;
  project: string | undefined;
  message: string | undefined;
  markdown: boolean;
}): string[] {
  const body = options.message ? ["--body", options.message, ...(options.markdown ? ["--markdown"] : [])] : [];
  return [
    "notification",
    "push",
    "--title",
    options.project ?? AGENT_NAMES[options.agent],
    ...body,
    "--icon",
    options.agent,
    "--run",
    options.focusCommand,
  ];
}

/**
 * Push a sidebar card when the agent's turn ends in a Herdr pane: the project as its
 * title and the agent's final message as its markdown body. Outside Herdr, or without the
 * sidebar CLI on PATH, it does nothing. A CLI too old for `--markdown` gets the message as
 * plain text. Returns false when the push failed.
 */
export async function runStop(
  agent: Agent,
  input: string,
  env: Environment,
  run: Runner,
  push: StatusRunner = spawnWithStatus,
): Promise<boolean> {
  const focusCommand = buildFocusCommand(env);
  if (focusCommand === undefined) return true;
  const sidebar = Bun.which(SIDEBAR_CLI, { PATH: env.PATH ?? "" });
  if (sidebar === null) return true;
  const project = await readProject(input, env, run);
  const message = finalMessage(input);
  const pushed = async (markdown: boolean) =>
    (await push([sidebar, ...buildPushArguments({ agent, focusCommand, project, message, markdown })], env)).status;
  let status = await pushed(true);
  if (status === USAGE_ERROR && message) status = await pushed(false);
  return status === 0;
}

if (import.meta.main) {
  const agent = parseAgent(process.argv[2]);
  // The harness writes the hook input to stdin; drain it so the write never fails.
  const input = await Bun.stdin.text();
  if (agent === undefined) {
    console.error(`herdrTurnNotification: expected the agent (${Object.keys(AGENT_NAMES).join(" or ")}) as argument`);
    process.exit(1);
  }
  if (!(await runStop(agent, input, process.env, spawnRunner))) {
    console.error(`herdrTurnNotification: ${SIDEBAR_CLI} notification push failed`);
    process.exit(1);
  }
}
