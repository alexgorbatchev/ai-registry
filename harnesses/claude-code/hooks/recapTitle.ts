import { quote } from "shell-quote";
import { type Environment, paneHostsProcess, readProject, type Runner, spawnRunner } from "./herdr";
import { resolveT3Session, type T3Session } from "./t3";

const RECAP_SOURCE = "recap";
const RECAP_PLACEHOLDER = "<recap>";

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
export function buildHerdrRecapInstruction(env: Environment, project: string | undefined): string | undefined {
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

/**
 * Return the end-of-turn recap instruction for a T3 Code thread: rename the thread with T3's own
 * `t3_thread_update` tool. T3 lists threads under their project, so the title carries only the recap. The agent
 * names the thread only when T3 cannot tell the calling thread itself (`T3Session.toolThreadId`).
 */
export function buildT3RecapInstruction(session: T3Session): string {
  const where = session.threadId ? `T3 Code thread ${session.threadId}` : "a T3 Code thread";
  const target = session.toolThreadId
    ? `\`threadId\` set to \`${session.toolThreadId}\``
    : "`threadId` left out so it renames this thread";
  return [
    `This session runs in ${where}. As the last tool call of this turn, after all other work and before the final reply, call T3's \`t3_thread_update\` tool once (load its schema first if it is deferred) with \`action\` set to \`rename\`, ${target}, and \`title\` set to a plain-text recap of what this session is working on, at most 60 characters.`,
    "",
    "Skip the call when the title you set earlier in this thread still describes the session, or when the user has said not to use tools this turn; otherwise make it even when the turn needs no other tool calls. Do not mention the title update in the reply. If the call fails, state the error in one line and do not retry.",
  ].join("\n");
}

/**
 * The recap instruction for where the session runs. A T3 Code thread wins over a Herdr pane, and a Herdr pane counts
 * only when it runs the hook (`paneHostsProcess`): T3 and Codex's shared app-server pass the variables of the pane
 * they started from to every session they run.
 */
async function recapInstruction(
  input: string,
  env: Environment,
  run: Runner,
  pid: number,
): Promise<string | undefined> {
  const session = await resolveT3Session(input, env);
  if (session) return buildT3RecapInstruction(session);
  if (!env.HERDR_PANE_ID || !(await paneHostsProcess(env, run, pid))) return undefined;
  return buildHerdrRecapInstruction(env, await readProject(input, env, run));
}

export async function runUserPromptSubmit(
  input: string,
  env: Environment,
  run: Runner,
  pid: number = process.pid,
): Promise<string> {
  const instruction = await recapInstruction(input, env, run, pid);
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
