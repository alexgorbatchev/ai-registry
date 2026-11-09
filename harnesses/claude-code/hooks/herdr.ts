import { basename } from "node:path";

export type Environment = Record<string, string | undefined>;

/** Run a command and return its stdout, or undefined when it cannot start or fails. */
export type Runner = (argv: string[], env: Environment) => Promise<string | undefined>;

/** Run a command and return its exit status, undefined when it cannot start, with its stdout. */
export type StatusRunner = (
  argv: string[],
  env: Environment,
) => Promise<{ status: number | undefined; stdout: string }>;

export const spawnWithStatus: StatusRunner = async (argv, env) => {
  try {
    const child = Bun.spawn(argv, { env, stdin: "ignore", stdout: "pipe", stderr: "ignore" });
    const stdout = await new Response(child.stdout).text();
    return { status: await child.exited, stdout };
  } catch {
    return { status: undefined, stdout: "" };
  }
};

export const spawnRunner: Runner = async (argv, env) => {
  const { status, stdout } = await spawnWithStatus(argv, env);
  return status === 0 ? stdout : undefined;
};

/** The folder the session works in, from the hook input's `cwd`. */
export function projectName(input: string): string | undefined {
  try {
    const cwd = JSON.parse(input)?.cwd;
    return typeof cwd === "string" && cwd ? basename(cwd) : undefined;
  } catch {
    return undefined;
  }
}

/** Read the label of the pane's Herdr workspace, which names the project it works on. */
export async function readWorkspaceLabel(env: Environment, run: Runner): Promise<string | undefined> {
  const workspaceId = env.HERDR_WORKSPACE_ID;
  if (!workspaceId) return undefined;
  const stdout = await run([env.HERDR_BIN_PATH || "herdr", "workspace", "get", workspaceId], env);
  if (stdout === undefined) return undefined;
  try {
    const label = JSON.parse(stdout)?.result?.workspace?.label;
    return typeof label === "string" && label.trim() ? label.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** The pid of the shell Herdr runs in the session's pane, or undefined when the pane is gone or Herdr does not answer. */
export async function readPaneShellPid(env: Environment, run: Runner): Promise<number | undefined> {
  const paneId = env.HERDR_PANE_ID;
  if (!paneId) return undefined;
  const stdout = await run([env.HERDR_BIN_PATH || "herdr", "pane", "process-info", "--pane", paneId], env);
  if (stdout === undefined) return undefined;
  try {
    const pid = JSON.parse(stdout)?.result?.process_info?.shell_pid;
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

/** Every process's parent, from `ps`, or undefined when `ps` cannot run. */
export async function readParentPids(env: Environment, run: Runner): Promise<Map<number, number> | undefined> {
  const stdout = await run(["ps", "-A", "-o", "pid=", "-o", "ppid="], env);
  if (stdout === undefined) return undefined;
  const parents = new Map<number, number>();
  for (const line of stdout.split("\n")) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (Number.isInteger(pid) && Number.isInteger(ppid)) parents.set(pid as number, ppid as number);
  }
  return parents;
}

/**
 * Whether the session's Herdr pane runs `pid`: the pane's shell is `pid` or one of its ancestors. Herdr variables
 * alone do not show it, because a long-lived server started from a pane, such as Codex's shared app-server, passes
 * them on to every session it runs, long after that pane is gone.
 */
export async function paneHostsProcess(env: Environment, run: Runner, pid: number): Promise<boolean> {
  const shellPid = await readPaneShellPid(env, run);
  if (shellPid === undefined) return false;
  const parents = await readParentPids(env, run);
  if (parents === undefined) return false;
  const seen = new Set<number>();
  for (let current: number | undefined = pid; current !== undefined && current > 0; current = parents.get(current)) {
    if (current === shellPid) return true;
    if (seen.has(current)) return false;
    seen.add(current);
  }
  return false;
}

/** The project a Herdr pane works on: its workspace label, else the session's folder. */
export async function readProject(input: string, env: Environment, run: Runner): Promise<string | undefined> {
  return (await readWorkspaceLabel(env, run)) ?? projectName(input);
}
