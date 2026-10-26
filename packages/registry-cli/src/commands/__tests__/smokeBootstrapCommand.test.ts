import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { smokeBootstrapCommand, type ISmokeBootstrapRunner } from "../smokeBootstrapCommand";

const TEST_ROOT = join(import.meta.dir, "..", "..", "..", ".tmp", "smoke-bootstrap-tests");
const PUBLIC_SCRIPTS = ["air-opencode-conversation-extract", "air-opencode-session-analysis", "air-opencode-session-export"];

async function writeTestFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

async function link(sourcePath: string, targetPath: string): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });
  await rm(targetPath, { force: true });
  await symlink(sourcePath, targetPath);
}

function getProfile(bootstrapArguments: string[], flag: string): string {
  const flagIndex = bootstrapArguments.indexOf(flag);
  return flagIndex === -1 ? "default" : bootstrapArguments[flagIndex + 1] ?? "default";
}

// Produces the layout a correct bootstrap leaves behind: real homes holding links
// to the generated entries, with earlier runtime data untouched.
async function emulateBootstrap(repositoryDir: string, bootstrapArguments: string[], environment: NodeJS.ProcessEnv): Promise<void> {
  const homeDir = environment.HOME ?? "";
  const outputDir = join(repositoryDir, ".output");
  const claudeProfile = getProfile(bootstrapArguments, "--claude-code-profile");
  const piProfile = getProfile(bootstrapArguments, "--pi-profile");
  const claudeHome = environment.CLAUDE_CONFIG_DIR ?? join(homeDir, ".claude");
  const piHome = environment.PI_CODING_AGENT_DIR ?? join(homeDir, ".pi", "agent");
  const profileHome = join(environment.XDG_DATA_HOME ?? "", "ai-registry", "claude-code", "profiles", "developer");

  await writeTestFile(join(outputDir, "manifest.json"), "{}\n");
  for (const profileName of ["default", "developer"]) {
    await writeTestFile(join(outputDir, "claude-code", profileName, "CLAUDE.md"), `${profileName}\n`);
    await writeTestFile(join(outputDir, "claude-code", profileName, "settings.json"), "{}\n");
    await writeTestFile(join(outputDir, "pi", profileName, "APPEND_SYSTEM.md"), `${profileName}\n`);
  }
  await writeTestFile(join(outputDir, "opencode", "opencode.jsonc"), "{}\n");
  for (const scriptName of PUBLIC_SCRIPTS) {
    await writeTestFile(join(outputDir, "bin", scriptName), "#!/usr/bin/env bash\n");
    await link(join(outputDir, "bin", scriptName), join(homeDir, ".local", "bin", scriptName));
  }

  await link(join(outputDir, "opencode", "opencode.jsonc"), join(environment.XDG_CONFIG_HOME ?? "", "opencode", "opencode.jsonc"));
  await link(join(outputDir, "claude-code", claudeProfile, "CLAUDE.md"), join(claudeHome, "CLAUDE.md"));
  await link(join(outputDir, "claude-code", claudeProfile, "settings.json"), join(claudeHome, "settings.json"));
  await link(join(outputDir, "claude-code", "developer", "CLAUDE.md"), join(profileHome, "CLAUDE.md"));
  await link(join(claudeHome, "existing.txt"), join(profileHome, "existing.txt"));
  await link(join(outputDir, "pi", piProfile, "APPEND_SYSTEM.md"), join(piHome, "APPEND_SYSTEM.md"));
}

describe("smokeBootstrapCommand", () => {
  let root: string;
  let runs: Array<{ bootstrapArguments: string[]; claudeConfigDir: string | undefined; piCodingAgentDir: string | undefined }>;
  let logLines: string[];

  function recordingRunner(runner: ISmokeBootstrapRunner): ISmokeBootstrapRunner {
    return async (repositoryDir, bootstrapArguments, environment) => {
      runs.push({
        bootstrapArguments,
        claudeConfigDir: environment.CLAUDE_CONFIG_DIR,
        piCodingAgentDir: environment.PI_CODING_AGENT_DIR,
      });
      await runner(repositoryDir, bootstrapArguments, environment);
    };
  }

  beforeEach(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    root = await mkdtemp(join(TEST_ROOT, "case-"));
    await writeTestFile(join(root, "package.json"), "{}\n");
    await writeTestFile(join(root, ".output", "stale.txt"), "not cloned\n");
    runs = [];
    logLines = [];
    spyOn(console, "log").mockImplementation((...values: unknown[]) => {
      logLines.push(values.join(" "));
    });
  });

  afterEach(async () => {
    mock.restore();
    await rm(root, { recursive: true, force: true });
  });

  it("passes when bootstrap keeps homes real and links the generated entries", async () => {
    await smokeBootstrapCommand({ root, runBootstrap: recordingRunner(emulateBootstrap) });

    const smokeHome = join(root, ".tmp", "bootstrap-smoke");
    expect(runs).toEqual([
      { bootstrapArguments: [], claudeConfigDir: undefined, piCodingAgentDir: undefined },
      { bootstrapArguments: [], claudeConfigDir: undefined, piCodingAgentDir: undefined },
      { bootstrapArguments: ["--pi-profile", "developer"], claudeConfigDir: undefined, piCodingAgentDir: join(smokeHome, ".pi", "agent") },
      { bootstrapArguments: ["--claude-code-profile", "developer"], claudeConfigDir: join(smokeHome, ".claude"), piCodingAgentDir: undefined },
    ]);
    expect(await Bun.file(join(smokeHome, "development", "ai-registry", "package.json")).text()).toBe("{}\n");
    expect(logLines.at(-2)).toBe("\nBootstrap smoke test passed.");
  });

  it("fails when bootstrap replaces a home with a symlink", async () => {
    const symlinkingRunner: ISmokeBootstrapRunner = async (repositoryDir, bootstrapArguments, environment) => {
      await emulateBootstrap(repositoryDir, bootstrapArguments, environment);
      const claudeHome = join(environment.HOME ?? "", ".claude");
      await rm(claudeHome, { recursive: true, force: true });
      await symlink(join(repositoryDir, ".output", "claude-code", "default"), claudeHome);
    };

    await expect(smokeBootstrapCommand({ root, runBootstrap: symlinkingRunner })).rejects.toThrow(
      `Expected a real directory at: ${join(root, ".tmp", "bootstrap-smoke", ".claude")}`,
    );
  });

  it("fails when bootstrap discards existing runtime data", async () => {
    const discardingRunner: ISmokeBootstrapRunner = async (repositoryDir, bootstrapArguments, environment) => {
      await rm(join(environment.XDG_CONFIG_HOME ?? "", "opencode", "existing.txt"), { force: true });
      await emulateBootstrap(repositoryDir, bootstrapArguments, environment);
    };

    await expect(smokeBootstrapCommand({ root, runBootstrap: discardingRunner })).rejects.toThrow(
      `Expected file to exist: ${join(root, ".tmp", "bootstrap-smoke", ".config", "opencode", "existing.txt")}`,
    );
  });
});
