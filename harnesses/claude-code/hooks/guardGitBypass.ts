import { basename } from "node:path";
import { parse } from "shell-quote";

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const CONTROL_OPERATORS = /[;&|()]+/;
const CONFIG_OVERRIDE = /^(?:GIT_CONFIG_GLOBAL|GIT_CONFIG_SYSTEM|GIT_CONFIG_NOSYSTEM|GIT_CONFIG_COUNT|GIT_CONFIG_PARAMETERS|GIT_CONFIG_(?:KEY|VALUE)_\d+)=/;
const HOOK_KEY = /^hook\./i;
const SHORT_NO_VERIFY = /^-[A-Za-z]*n[A-Za-z]*$/;
const SHELL_COMMAND_OPTION = /^-[A-Za-z]*c$/;
const GISTS_PATH = /(?:^|\/)gists(?:\/|$)/;
const API_INLINE_METHOD = /^(?:-X|--method=)(.+)$/;
const API_BODY_OPTION = /^(?:-f|-F|--field|--raw-field|--input)(?:=|$)/;

const HEREDOC = /^(.*<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2.*)\n(?:[\s\S]*?\n)?[ \t]*\3[ \t]*$/gm;
const SHELL_INPUT = /(?:^|[|;&]\s*)(?:\S*\/)?(?:bash|dash|sh|zsh)(?:\s|$)/;

const WRAPPERS = new Set(["command", "env", "exec", "nohup", "sudo", "time", "xargs"]);
const SHELLS = new Set(["bash", "dash", "sh", "zsh"]);
const GIT_OPTIONS_WITH_VALUE = new Set(["-C", "--exec-path", "--git-dir", "--namespace", "--work-tree"]);
const GIST_WRITES = new Set(["create", "edit", "new", "rename"]);
const CONFIG_READS = new Set(["--get", "--get-all", "--get-regexp", "--list", "-l", "get", "list"]);

/** Split a command line into simple commands, one per shell control operator. */
function splitCommands(command: string): string[][] {
  let entries: ReturnType<typeof parse>;
  try {
    entries = parse(command, (name) => `$${name}`);
  } catch {
    // The parser rejects valid expansions such as ${path%%/*}. Those must neither
    // block the command nor exempt it, so the words are still inspected.
    return command.split(CONTROL_OPERATORS).map((part) => part.split(/\s+/).filter(Boolean));
  }
  let current: string[] = [];
  const commands = [current];
  for (const entry of entries) {
    if (typeof entry === "string") {
      current.push(entry);
    } else if ("op" in entry && entry.op === "glob") {
      current.push(entry.pattern);
    } else if ("op" in entry) {
      current = [];
      commands.push(current);
    }
  }
  return commands;
}

function stripWrappers(words: string[]): string[] {
  let index = 0;
  let isWrapped = false;
  while (index < words.length) {
    const word = words[index] ?? "";
    if (ASSIGNMENT.test(word) || (isWrapped && word.startsWith("-"))) {
      index += 1;
    } else if (WRAPPERS.has(basename(word))) {
      isWrapped = true;
      index += 1;
    } else {
      break;
    }
  }
  return words.slice(index);
}

function checkGit(args: string[]): string | undefined {
  let index = 0;
  while ((args[index] ?? "").startsWith("-")) {
    const option = args[index] ?? "";
    const value = option === "-c" || option === "--config-env" ? args[index + 1] : option.split("--config-env=")[1];
    if (value !== undefined && HOOK_KEY.test(value)) return "overriding Git hook configuration";
    index += option === "-c" || option === "--config-env" || GIT_OPTIONS_WITH_VALUE.has(option) ? 2 : 1;
  }
  const subcommand = args[index];
  const rest = args.slice(index + 1);
  if (rest.includes("--no-verify")) return "skipping Git hooks with --no-verify";
  if ((subcommand === "commit" || subcommand === "am") && rest.some((word) => SHORT_NO_VERIFY.test(word))) {
    return "skipping Git hooks with -n";
  }
  if (subcommand === "config" && rest.some((word) => HOOK_KEY.test(word)) && !rest.some((word) => CONFIG_READS.has(word))) {
    return "changing Git hook configuration";
  }
  return undefined;
}

/** Resolve the gh api method: explicit when given, otherwise POST once a body field is present. */
function getApiMethod(args: string[]): string {
  for (const [index, word] of args.entries()) {
    if (word === "-X" || word === "--method") return (args[index + 1] ?? "").toUpperCase();
    const inline = word.match(API_INLINE_METHOD)?.[1];
    if (inline !== undefined) return inline.toUpperCase();
  }
  return args.some((word) => API_BODY_OPTION.test(word)) ? "POST" : "GET";
}

function checkGitHub(args: string[]): string | undefined {
  const isGistWrite = args[0] === "gist"
    ? GIST_WRITES.has(args[1] ?? "")
    : args[0] === "api" && args.some((word) => GISTS_PATH.test(word)) && getApiMethod(args) !== "GET";
  return isGistWrite ? "publishing a gist, which no scanner inspects" : undefined;
}

function checkCommand(words: string[]): string | undefined {
  if (words.some((word) => CONFIG_OVERRIDE.test(word))) return "replacing the Git configuration that holds the hooks";
  const [executable, ...args] = stripWrappers(words);
  if (executable === undefined) return undefined;
  const name = basename(executable);
  if (name.startsWith("gitleaks-disable") || executable.endsWith("tools/gitleaks/disable.ts")) {
    return "changing a Gitleaks exception";
  }
  if (args.some((word) => word.endsWith("tools/gitleaks/disable.ts"))) return "changing a Gitleaks exception";
  if (name === "git") return checkGit(args);
  if (name === "gh") return checkGitHub(args);
  if (name === "eval") return findViolation(args.join(" "));
  if (SHELLS.has(name)) {
    const option = args.findIndex((word) => SHELL_COMMAND_OPTION.test(word));
    const script = args[option + 1];
    if (option !== -1 && script !== undefined) return findViolation(script);
  }
  return undefined;
}

/** Drop heredoc bodies, which are file content unless a shell reads them. */
function stripHeredocs(command: string): string {
  return command.replace(HEREDOC, (match, line: string) => (SHELL_INPUT.test(line) ? match : line));
}

/** Return why a shell command would skip the publication gate, if it would. */
export function findViolation(command: string): string | undefined {
  const script = stripHeredocs(command);
  // Shell lines end commands, but the parser treats newlines as plain whitespace.
  for (const source of new Set([script, ...script.split("\n")])) {
    for (const words of splitCommands(source)) {
      const violation = checkCommand(words);
      if (violation !== undefined) return violation;
    }
  }
  return undefined;
}

export function runPreToolUse(input: unknown): string {
  if (typeof input !== "object" || input === null || !("tool_input" in input)) {
    throw new Error("PreToolUse input must contain tool_input");
  }
  const toolInput = input.tool_input;
  if (typeof toolInput !== "object" || toolInput === null || !("command" in toolInput) || typeof toolInput.command !== "string") {
    throw new Error("PreToolUse input must contain a command");
  }
  const violation = findViolation(toolInput.command);
  if (violation === undefined) return "";
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `Blocked: ${violation}. Fix the finding instead, or ask the user to run this themselves.`,
    },
  });
}

if (import.meta.main) {
  try {
    const output = runPreToolUse(await Bun.stdin.json());
    if (output) console.log(output);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
