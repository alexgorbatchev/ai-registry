import { basename } from "node:path";

export type Environment = Record<string, string | undefined>;

/** Run a command and return its stdout, or undefined when it cannot start or fails. */
export type Runner = (argv: string[], env: Environment) => Promise<string | undefined>;

export const spawnRunner: Runner = async (argv, env) => {
  try {
    const child = Bun.spawn(argv, { env, stdin: "ignore", stdout: "pipe", stderr: "ignore" });
    const stdout = await new Response(child.stdout).text();
    return (await child.exited) === 0 ? stdout : undefined;
  } catch {
    return undefined;
  }
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

/** The project a Herdr pane works on: its workspace label, else the session's folder. */
export async function readProject(input: string, env: Environment, run: Runner): Promise<string | undefined> {
  return (await readWorkspaceLabel(env, run)) ?? projectName(input);
}
