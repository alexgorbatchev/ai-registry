import { beforeAll, describe, expect, it } from "bun:test";
import { chmod, cp, lstat, mkdir, readdir, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";

import { ENTRY_POINT_COMMAND_LINES } from "../../lib/entryPointCommandLines";
import { parseCommandLine } from "../../lib/readCommandLine";
import { factory_testDirectory, factory_testRoot } from "./fixtures";

const packageRoot = resolve(import.meta.dir, "../../..");
const repositoryRoot = resolve(packageRoot, "../..");

// Commands the entry points could reach. Each stub records its invocation and fails, so a
// regression that starts work cannot reach real tools, remotes, or harness homes.
const STUBBED_COMMANDS = ["bun", "flock", "git", "gitleaks", "just", "lockf", "npx"];

// Entry points without side effects: a coverage report reader and the pre-push scan, whose
// positional arguments come from Git.
const READ_ONLY_ENTRY_POINTS = ["check-coverage.ts", "scan-pushed-commits.ts"];

type IEntryPoint = keyof typeof ENTRY_POINT_COMMAND_LINES;

// add-vendored-skill.ts passes its arguments through to the command and has its own tests below.
const ENTRY_POINTS = Object.keys(ENTRY_POINT_COMMAND_LINES).filter(
  (entryPoint): entryPoint is IEntryPoint =>
    entryPoint in ENTRY_POINT_COMMAND_LINES && entryPoint !== "add-vendored-skill.ts",
);

function getHelp(entryPoint: IEntryPoint): string {
  const parsed = parseCommandLine(["--help"], ENTRY_POINT_COMMAND_LINES[entryPoint]);
  return parsed.kind === "help" ? `${parsed.text}\n` : "";
}

type IEntryPointRun = {
  exitCode: number;
  stdout: string;
  stderr: string;
  stubCalls: string;
};

const sandbox = factory_testRoot("entry-points");
const fakeRepository = join(sandbox, "repository");
const stubBin = join(sandbox, "stub-bin");

// Lists every entry with its size and modification time without following symbolic links,
// so the linked node_modules directories count as single entries.
async function listTree(directory: string, prefix = ""): Promise<string[]> {
  const listing: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const stats = await lstat(path);
    listing.push(`${prefix}${entry.name} ${stats.isDirectory() ? "dir" : stats.size} ${stats.mtimeMs}`);
    if (entry.isDirectory()) listing.push(...(await listTree(path, `${prefix}${entry.name}/`)));
  }
  return listing.sort();
}

// Runs a copy of the entry point inside a disposable repository whose own location and
// working directory are both scratch space, with a scratch HOME and only stubbed tools on PATH.
async function runEntryPoint(entryPoint: string, args: string[]): Promise<IEntryPointRun> {
  const scratch = factory_testDirectory("entry-point");
  const home = join(scratch, "home");
  const temp = join(scratch, "tmp");
  const stubLog = join(scratch, "stub-calls");
  await mkdir(home);
  await mkdir(temp);
  const repositoryBefore = await listTree(fakeRepository);
  const homeBefore = await listTree(home);

  const result = Bun.spawnSync(
    [process.execPath, join(fakeRepository, "packages/registry-cli/src/bin", entryPoint), ...args],
    {
      cwd: fakeRepository,
      env: {
        HOME: home,
        PATH: stubBin,
        STUB_LOG: stubLog,
        TMPDIR: temp,
        // Bun otherwise caches transpiled sources under HOME.
        BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
        GIT_CEILING_DIRECTORIES: sandbox,
        CLAUDE_CONFIG_DIR: join(home, ".claude"),
        CODEX_HOME: join(home, ".codex"),
        PI_CODING_AGENT_DIR: join(home, ".pi"),
        OPENCODE_CONFIG_DIR: join(home, ".opencode"),
        XDG_CONFIG_HOME: join(home, ".config"),
      },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 30_000,
    },
  );

  const stubCalls = (await Bun.file(stubLog).exists()) ? await Bun.file(stubLog).text() : "";
  expect(await listTree(fakeRepository)).toEqual(repositoryBefore);
  expect(await listTree(home)).toEqual(homeBefore);
  return {
    exitCode: result.exitCode ?? -1,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    stubCalls,
  };
}

beforeAll(async () => {
  const fakePackage = join(fakeRepository, "packages/registry-cli");

  await cp(join(packageRoot, "src"), join(fakePackage, "src"), { recursive: true });
  await cp(join(packageRoot, "package.json"), join(fakePackage, "package.json"));
  await symlink(join(packageRoot, "node_modules"), join(fakePackage, "node_modules"));
  await symlink(join(repositoryRoot, "node_modules"), join(fakeRepository, "node_modules"));

  await mkdir(stubBin);
  for (const command of STUBBED_COMMANDS) {
    const stub = join(stubBin, command);
    await Bun.write(stub, `#!/bin/sh\nprintf '%s\\n' "${command} $*" >> "$STUB_LOG"\nexit 1\n`);
    await chmod(stub, 0o755);
  }
});

describe("side-effecting entry points", () => {
  it("declares a command line for every entry point except the read-only ones", async () => {
    const entryPoints = (await readdir(join(packageRoot, "src/bin"))).filter((name) => name.endsWith(".ts"));

    expect(Object.keys(ENTRY_POINT_COMMAND_LINES).sort()).toEqual(
      entryPoints.filter((name) => !READ_ONLY_ENTRY_POINTS.includes(name)).sort(),
    );
  });

  it.each(
    ENTRY_POINTS.flatMap((entryPoint): [IEntryPoint, string][] => [
      [entryPoint, "--help"],
      [entryPoint, "-h"],
    ]),
  )("%s %s prints usage and exits 0 without doing any work", async (entryPoint, flag) => {
    const result = await runEntryPoint(entryPoint, [flag]);

    expect(result).toEqual({ exitCode: 0, stdout: getHelp(entryPoint), stderr: "", stubCalls: "" });
  });

  it.each(ENTRY_POINTS)("%s rejects unknown options with a usage error", async (entryPoint) => {
    const result = await runEntryPoint(entryPoint, ["--unknown-option"]);

    expect(result).toMatchObject({ exitCode: 2, stdout: "", stubCalls: "" });
    expect(result.stderr).toStartWith("Unknown option '--unknown-option'");
    expect(result.stderr).toEndWith(`\n\n${getHelp(entryPoint)}`);
  });

  it.each(ENTRY_POINTS.filter((entryPoint) => !("positionals" in ENTRY_POINT_COMMAND_LINES[entryPoint])))(
    "%s rejects positional arguments with a usage error",
    async (entryPoint) => {
      const result = await runEntryPoint(entryPoint, ["help"]);

      expect(result).toMatchObject({ exitCode: 2, stdout: "", stubCalls: "" });
      expect(result.stderr).toStartWith("Unexpected argument 'help'");
    },
  );

  // Bootstrap runs `just build -y`, scheduled updates run `just bootstrap -y`, and docs use `--yes`.
  it.each([
    ["build.ts", "-y"],
    ["build.ts", "--yes"],
    ["bootstrap.ts", "-y"],
    ["bootstrap.ts", "--yes"],
  ] satisfies [IEntryPoint, string][])("%s accepts %s from its callers", (entryPoint, flag) => {
    expect(parseCommandLine([flag], ENTRY_POINT_COMMAND_LINES[entryPoint])).toEqual({
      kind: "run",
      commandLine: { flags: { yes: true }, positionals: [] },
    });
  });

  it("bootstrap accepts -y and starts its work", async () => {
    const result = await runEntryPoint("bootstrap.ts", ["-y"]);

    expect(result.exitCode).toBe(1);
    expect(result.stubCalls).toContain("just setup\n");
    expect(result.stderr).toContain("Failed to install dependencies and Git hooks");
  });
});

describe("add-vendored-skill.ts", () => {
  it.each(["--help", "-h"])("%s prints usage and exits 0 without doing any work", async (flag) => {
    const result = await runEntryPoint("add-vendored-skill.ts", [flag]);

    expect(result).toMatchObject({ exitCode: 0, stderr: "", stubCalls: "" });
    expect(result.stdout).toStartWith("Usage: just skills-add ");
    expect(result.stdout).toContain("\n  -h, --help  Show this help and exit\n");
  });

  it("leaves wrapped options to the command, which rejects unsupported ones before any work", async () => {
    const result = await runEntryPoint("add-vendored-skill.ts", ["npx skills add owner/repo --unknown-option"]);

    expect(result).toMatchObject({ exitCode: 1, stdout: "", stubCalls: "" });
    expect(result.stderr).toContain("Unsupported option for just skills-add: --unknown-option");
  });
});
