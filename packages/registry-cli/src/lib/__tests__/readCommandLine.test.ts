import { describe, expect, it } from "bun:test";

import { parseCommandLine, readCommandLine, type ICommandLineSpec } from "../readCommandLine";

const BUILD_SPEC: ICommandLineSpec = {
  usage: "just build [options]",
  description: "Build outputs.",
  flags: {
    yes: { short: "y", description: "Confirm without prompting" },
    verbose: { description: "Print more" },
  },
};

const BUILD_HELP = [
  "Usage: just build [options]",
  "",
  "Build outputs.",
  "",
  "Options:",
  "  -y, --yes      Confirm without prompting",
  "      --verbose  Print more",
  "  -h, --help     Show this help and exit",
].join("\n");

const NO_ARGUMENT_SPEC: ICommandLineSpec = { usage: "just bootstrap-smoke", description: "Smoke test." };

type IRecordedOutput = { stdout: string[]; stderr: string[]; exitCodes: number[] };

function createOutput() {
  const output: IRecordedOutput = { stdout: [], stderr: [], exitCodes: [] };
  return {
    output,
    writer: {
      stdout: (text: string) => output.stdout.push(text),
      stderr: (text: string) => output.stderr.push(text),
      setExitCode: (code: number) => output.exitCodes.push(code),
    },
  };
}

describe("parseCommandLine", () => {
  it.each([[["-h"]], [["--help"]], [["-y", "--help"]]])("returns help for %j without running the command", (args) => {
    expect(parseCommandLine(args, BUILD_SPEC)).toEqual({ kind: "help", text: BUILD_HELP });
  });

  it.each([
    [[], { yes: false, verbose: false }],
    [["-y"], { yes: true, verbose: false }],
    [["--yes", "--verbose"], { yes: true, verbose: true }],
  ])("parses declared flags from %j", (args, flags) => {
    expect(parseCommandLine(args, BUILD_SPEC)).toEqual({ kind: "run", commandLine: { flags, positionals: [] } });
  });

  it.each([
    [["--unknown"], "Unknown option '--unknown'"],
    [["-x"], "Unknown option '-x'"],
    [["--yes=1"], "does not take an argument"],
    [["extra"], "Unexpected argument 'extra'"],
    [["--help", "--unknown"], "Unknown option '--unknown'"],
  ])("rejects %j with the error and usage", (args, message) => {
    const result = parseCommandLine(args, BUILD_SPEC);

    expect(result.kind).toBe("usage-error");
    expect(result.kind === "usage-error" ? result.text : "").toContain(message);
    expect(result.kind === "usage-error" ? result.text : "").toEndWith(`\n\n${BUILD_HELP}`);
  });

  it("documents and accepts positionals only for commands that declare them", () => {
    const spec: ICommandLineSpec = {
      usage: "update [skill...]",
      description: "Update.",
      positionals: "skill...  Names",
    };

    expect(parseCommandLine(["one", "two"], spec)).toEqual({
      kind: "run",
      commandLine: { flags: {}, positionals: ["one", "two"] },
    });
    expect(parseCommandLine(["--help"], spec)).toEqual({
      kind: "help",
      text: "Usage: update [skill...]\n\nUpdate.\n\nArguments:\n  skill...  Names\n\nOptions:\n  -h, --help  Show this help and exit",
    });
    expect(parseCommandLine(["one"], NO_ARGUMENT_SPEC).kind).toBe("usage-error");
  });

  it("leaves pass-through arguments to the command except a separate help request", () => {
    const spec: ICommandLineSpec = { usage: "skills-add '<command>'", description: "Add.", isPassThrough: true };

    expect(parseCommandLine(["npx skills add source --skill one", "--unknown"], spec)).toEqual({
      kind: "run",
      commandLine: { flags: {}, positionals: ["npx skills add source --skill one", "--unknown"] },
    });
    expect(parseCommandLine(["-h"], spec).kind).toBe("help");
    expect(parseCommandLine(["source", "--help"], spec).kind).toBe("help");
  });
});

describe("readCommandLine", () => {
  it("prints help to stdout and returns nothing to run without setting a failure", () => {
    const { output, writer } = createOutput();

    expect(readCommandLine(["--help"], BUILD_SPEC, writer)).toBeUndefined();
    expect(output).toEqual({ stdout: [BUILD_HELP], stderr: [], exitCodes: [] });
  });

  it("prints usage errors to stderr and exits with status 2", () => {
    const { output, writer } = createOutput();

    expect(readCommandLine(["--unknown"], NO_ARGUMENT_SPEC, writer)).toBeUndefined();
    expect(output.stdout).toEqual([]);
    expect(output.stderr).toHaveLength(1);
    expect(output.stderr[0]).toStartWith("Unknown option '--unknown'");
    expect(output.exitCodes).toEqual([2]);
  });

  it("returns the parsed command line silently when it is valid", () => {
    const { output, writer } = createOutput();

    expect(readCommandLine(["-y"], BUILD_SPEC, writer)).toEqual({
      flags: { yes: true, verbose: false },
      positionals: [],
    });
    expect(output).toEqual({ stdout: [], stderr: [], exitCodes: [] });
  });

  // Entry point subprocess tests cover the default exit code; setting it here would fail the test run.
  it("prints help to the process output by default", () => {
    const { log } = console;
    const logged: string[] = [];
    console.log = (text: string) => logged.push(text);
    try {
      expect(readCommandLine(["-h"], NO_ARGUMENT_SPEC)).toBeUndefined();
    } finally {
      console.log = log;
    }
    expect(logged).toEqual([
      "Usage: just bootstrap-smoke\n\nSmoke test.\n\nOptions:\n  -h, --help  Show this help and exit",
    ]);
  });
});
