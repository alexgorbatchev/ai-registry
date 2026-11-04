import { quote } from "shell-quote";

const RECAP_SOURCE = "recap";
const RECAP_PLACEHOLDER = "<recap>";

type Environment = Record<string, string | undefined>;

/**
 * Build the command that sets the pane title. Pane, binary, and socket are written
 * literally because a harness may not pass Herdr variables to the agent's shell.
 */
export function buildRecapCommand(env: Environment): string | undefined {
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
  return [...socket, argv, `'${RECAP_PLACEHOLDER}'`].join(" ");
}

/** Return the end-of-turn recap instruction when the session runs in a Herdr pane. */
export function buildRecapInstruction(env: Environment): string | undefined {
  const command = buildRecapCommand(env);
  if (command === undefined) return undefined;
  return [
    `This session runs in Herdr pane ${env.HERDR_PANE_ID}. As the last tool call of this turn, after all other work and before the final reply, run this command once to set the pane title:`,
    "",
    command,
    "",
    `Replace ${RECAP_PLACEHOLDER} inside the single quotes with a plain-text recap of what this session is working on, at most 60 characters, containing no single quotes. Run it even when the turn needs no other tool calls; skip it only when the user has said not to run commands this turn. Do not mention the title update in the reply. If the command fails, state the error in one line and do not retry.`,
  ].join("\n");
}

export function runUserPromptSubmit(env: Environment): string {
  const instruction = buildRecapInstruction(env);
  if (instruction === undefined) return "";
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: instruction,
    },
  });
}

if (import.meta.main) {
  // The harness writes the hook input to stdin; drain it so the write never fails.
  await Bun.stdin.text();
  const output = runUserPromptSubmit(process.env);
  if (output) console.log(output);
}
