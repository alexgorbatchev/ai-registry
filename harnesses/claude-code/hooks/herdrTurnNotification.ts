import { quote } from "shell-quote";
import { type Environment, readProject, type Runner, spawnRunner } from "./herdr";

const SIDEBAR_CLI = "aerospace-sidebar";

const AGENT_NAMES = { claude: "Claude", codex: "Codex" } as const;

/** Characters of the agent's final message a card shows. */
export const MAX_BODY_LENGTH = 300;

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
 * The agent's final message from the Stop input's `last_assistant_message`, on one line
 * and cut to `MAX_BODY_LENGTH` characters.
 */
export function finalMessage(input: string): string | undefined {
  let message: unknown;
  try {
    message = JSON.parse(input)?.last_assistant_message;
  } catch {
    return undefined;
  }
  if (typeof message !== "string") return undefined;
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  const characters = [...new Intl.Segmenter().segment(text)].map(({ segment }) => segment);
  return characters.length > MAX_BODY_LENGTH
    ? `${characters
        .slice(0, MAX_BODY_LENGTH - 1)
        .join("")
        .trimEnd()}…`
    : text;
}

export function buildPushArguments(options: {
  agent: Agent;
  focusCommand: string;
  project: string | undefined;
  message: string | undefined;
}): string[] {
  const body = options.message ? ["--body", options.message] : [];
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
 * title and the agent's final message as its body. Outside Herdr, or without the
 * sidebar CLI on PATH, it does nothing. Returns false when the push failed.
 */
export async function runStop(agent: Agent, input: string, env: Environment, run: Runner): Promise<boolean> {
  const focusCommand = buildFocusCommand(env);
  if (focusCommand === undefined) return true;
  const sidebar = Bun.which(SIDEBAR_CLI, { PATH: env.PATH ?? "" });
  if (sidebar === null) return true;
  const project = await readProject(input, env, run);
  const args = buildPushArguments({ agent, focusCommand, project, message: finalMessage(input) });
  return (await run([sidebar, ...args], env)) !== undefined;
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
