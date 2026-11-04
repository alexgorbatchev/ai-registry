import { basename } from "node:path";
import { quote } from "shell-quote";

const SIDEBAR_CLI = "aerospace-sidebar";

const AGENT_NAMES = { claude: "Claude", codex: "Codex" } as const;

export type Agent = keyof typeof AGENT_NAMES;

type Environment = Record<string, string | undefined>;

/** Run a command and return its stdout, or undefined when it cannot start or fails. */
export type Runner = (argv: string[], env: Environment) => Promise<string | undefined>;

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

/** Read the pane's title, which the recap hook keeps set to what the session works on. */
export async function readPaneTitle(env: Environment, run: Runner): Promise<string | undefined> {
  const paneId = env.HERDR_PANE_ID;
  if (!paneId) return undefined;
  const stdout = await run([env.HERDR_BIN_PATH || "herdr", "pane", "get", paneId], env);
  if (stdout === undefined) return undefined;
  try {
    const title = JSON.parse(stdout)?.result?.pane?.title;
    return typeof title === "string" && title.trim() ? title.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function buildPushArguments(options: {
  agent: Agent;
  focusCommand: string;
  summary: string | undefined;
}): string[] {
  const body = options.summary ? ["--body", options.summary] : [];
  return [
    "notification",
    "push",
    "--title",
    `${AGENT_NAMES[options.agent]} finished`,
    ...body,
    "--icon",
    options.agent,
    "--run",
    options.focusCommand,
  ];
}

/** The project folder the agent worked in, from the hook input's `cwd`. */
export function projectName(input: string): string | undefined {
  try {
    const cwd = JSON.parse(input)?.cwd;
    return typeof cwd === "string" && cwd ? basename(cwd) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Push a sidebar card when the agent's turn ends in a Herdr pane. Outside Herdr, or
 * without the sidebar CLI on PATH, it does nothing. Returns false when the push failed.
 */
export async function runStop(agent: Agent, input: string, env: Environment, run: Runner): Promise<boolean> {
  const focusCommand = buildFocusCommand(env);
  if (focusCommand === undefined) return true;
  const sidebar = Bun.which(SIDEBAR_CLI, { PATH: env.PATH ?? "" });
  if (sidebar === null) return true;
  const summary = (await readPaneTitle(env, run)) ?? projectName(input);
  const pushed = await run([sidebar, ...buildPushArguments({ agent, focusCommand, summary })], env);
  return pushed !== undefined;
}

export const spawnRunner: Runner = async (argv, env) => {
  try {
    const child = Bun.spawn(argv, { env, stdin: "ignore", stdout: "pipe", stderr: "ignore" });
    const stdout = await new Response(child.stdout).text();
    return (await child.exited) === 0 ? stdout : undefined;
  } catch {
    return undefined;
  }
};

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
