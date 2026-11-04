import { quote } from "shell-quote";
import { projectName, type Runner, spawnRunner } from "./herdrTurnNotification";

const RECAP_SOURCE = "recap";
const RECAP_PLACEHOLDER = "<recap>";

type Environment = Record<string, string | undefined>;

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

/**
 * Build the command that sets the pane title, starting with the project name so the
 * agent writes only the recap. Pane, binary, and socket are written literally because
 * a harness may not pass Herdr variables to the agent's shell.
 */
export function buildRecapCommand(env: Environment, project: string | undefined): string | undefined {
  const paneId = env.HERDR_PANE_ID;
  if (!paneId) return undefined;
  const socket = env.HERDR_SOCKET_PATH ? [`HERDR_SOCKET_PATH=${quote([env.HERDR_SOCKET_PATH])}`] : [];
  const argv = quote([
    env.HERDR_BIN_PATH || "herdr",
    "pane",
    "report-metadata",
    paneId,
    "--source",
    RECAP_SOURCE,
    "--title",
  ]);
  // The title is single-quoted for the agent to fill in, so the project drops quotes.
  const prefix = project ? `${project.replace(/'/g, "")}: ` : "";
  return [...socket, argv, `'${prefix}${RECAP_PLACEHOLDER}'`].join(" ");
}

/** Return the end-of-turn recap instruction when the session runs in a Herdr pane. */
export function buildRecapInstruction(env: Environment, project: string | undefined): string | undefined {
  const command = buildRecapCommand(env, project);
  if (command === undefined) return undefined;
  return [
    `This session runs in Herdr pane ${env.HERDR_PANE_ID}. As the last tool call of this turn, after all other work and before the final reply, run this command once to set the pane title:`,
    "",
    command,
    "",
    `Replace ${RECAP_PLACEHOLDER} inside the single quotes with a plain-text recap of what this session is working on, at most 60 characters, containing no single quotes.${project ? " The title already starts with the project name, so do not repeat it in the recap." : ""} Run it even when the turn needs no other tool calls; skip it only when the user has said not to run commands this turn. Do not mention the title update in the reply. If the command fails, state the error in one line and do not retry.`,
  ].join("\n");
}

export async function runUserPromptSubmit(input: string, env: Environment, run: Runner): Promise<string> {
  if (!env.HERDR_PANE_ID) return "";
  const project = (await readWorkspaceLabel(env, run)) ?? projectName(input);
  const instruction = buildRecapInstruction(env, project);
  if (instruction === undefined) return "";
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: instruction,
    },
  });
}

if (import.meta.main) {
  const output = await runUserPromptSubmit(await Bun.stdin.text(), process.env, spawnRunner);
  if (output) console.log(output);
}
