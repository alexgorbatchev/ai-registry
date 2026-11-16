import { parseArgs } from "node:util";

import { getErrorMessage } from "./getErrorMessage";

type ICommandFlag = {
  short?: string;
  description: string;
};

export type ICommandLineSpec = {
  /** Invocation shown after `Usage:`, such as `just build [options]`. */
  usage: string;
  description: string;
  /** Boolean flags accepted besides `-h`/`--help`. */
  flags?: Record<string, ICommandFlag>;
  /** Describes accepted positional arguments; commands without it reject positionals. */
  positionals?: string;
  /**
   * The command parses its own arguments, so only a separate `-h`/`--help` argument is
   * recognized here and everything else is left for the command to validate.
   */
  isPassThrough?: boolean;
};

type ICommandLine = {
  flags: Record<string, boolean>;
  positionals: string[];
};

type IParsedCommandLine =
  | { kind: "run"; commandLine: ICommandLine }
  | { kind: "help"; text: string }
  | { kind: "usage-error"; text: string };

type ICommandLineOutput = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  setExitCode: (code: number) => void;
};

const HELP_FLAG: ICommandFlag = { short: "h", description: "Show this help and exit" };
const USAGE_ERROR_EXIT_CODE = 2;

function formatFlag(name: string, flag: ICommandFlag): string {
  return flag.short === undefined ? `    --${name}` : `-${flag.short}, --${name}`;
}

function formatHelp(spec: ICommandLineSpec): string {
  const flags = Object.entries({ ...spec.flags, help: HELP_FLAG });
  const labels = flags.map(([name, flag]) => formatFlag(name, flag));
  const width = Math.max(...labels.map((label) => label.length));
  const lines = [`Usage: ${spec.usage}`, "", spec.description];
  if (spec.positionals !== undefined) {
    lines.push("", "Arguments:", `  ${spec.positionals}`);
  }
  lines.push("", "Options:");
  flags.forEach(([, flag], index) => lines.push(`  ${labels[index].padEnd(width)}  ${flag.description}`));
  return lines.join("\n");
}

export function parseCommandLine(args: string[], spec: ICommandLineSpec): IParsedCommandLine {
  if (spec.isPassThrough === true) {
    return args.some((argument) => argument === "-h" || argument === "--help")
      ? { kind: "help", text: formatHelp(spec) }
      : { kind: "run", commandLine: { flags: {}, positionals: args } };
  }

  const options: Record<string, { type: "boolean"; short?: string }> = {};
  for (const [name, flag] of Object.entries({ ...spec.flags, help: HELP_FLAG })) {
    options[name] = flag.short === undefined ? { type: "boolean" } : { type: "boolean", short: flag.short };
  }

  try {
    const { values, positionals } = parseArgs({
      args,
      options,
      allowPositionals: spec.positionals !== undefined,
      strict: true,
    });
    if (values.help === true) {
      return { kind: "help", text: formatHelp(spec) };
    }
    const flags: Record<string, boolean> = {};
    for (const name of Object.keys(spec.flags ?? {})) {
      flags[name] = values[name] === true;
    }
    return { kind: "run", commandLine: { flags, positionals } };
  } catch (error) {
    return { kind: "usage-error", text: `${getErrorMessage(error)}\n\n${formatHelp(spec)}` };
  }
}

const processOutput: ICommandLineOutput = {
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

/**
 * Prints usage for `-h`/`--help` or a usage error for invalid arguments and returns
 * `undefined`, so entry points do no work unless the command line is valid.
 */
export function readCommandLine(
  args: string[],
  spec: ICommandLineSpec,
  output: ICommandLineOutput = processOutput,
): ICommandLine | undefined {
  const parsed = parseCommandLine(args, spec);
  if (parsed.kind === "help") {
    output.stdout(parsed.text);
    return undefined;
  }
  if (parsed.kind === "usage-error") {
    output.stderr(parsed.text);
    output.setExitCode(USAGE_ERROR_EXIT_CODE);
    return undefined;
  }
  return parsed.commandLine;
}
