import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { smokeBootstrapCommand, type ISmokeBootstrapRunner } from "../smokeBootstrapCommand";

const TEST_ROOT = join(import.meta.dir, "..", "..", "..", ".tmp", "smoke-bootstrap-tests");
const PUBLIC_SCRIPTS = [
  "air-opencode-conversation-extract",
  "air-opencode-session-analysis",
  "air-opencode-session-export",
];

async function writeTestFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

async function link(sourcePath: string, targetPath: string): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });
  await rm(targetPath, { force: true });
  await symlink(sourcePath, targetPath);
}

// Produces the layout a correct bootstrap leaves behind: real homes holding links
// to the generated entries, with earlier runtime data untouched.
async function emulateBootstrap(repositoryDir: string, environment: NodeJS.ProcessEnv): Promise<void> {
  const homeDir = environment.HOME ?? "";
  const outputDir = join(repositoryDir, ".output");
  const claudeHome = join(homeDir, ".claude");
  const piHome = join(homeDir, ".pi", "agent");

  await writeTestFile(join(outputDir, "manifest.json"), "{}\n");
  await writeTestFile(join(outputDir, "claude-code", "CLAUDE.md"), "system\n");
  await writeTestFile(join(outputDir, "claude-code", "settings.json"), "{}\n");
  await writeTestFile(join(outputDir, "pi", "APPEND_SYSTEM.md"), "system\n");
  await writeTestFile(join(outputDir, "opencode", "opencode.jsonc"), "{}\n");
  for (const scriptName of PUBLIC_SCRIPTS) {
    await writeTestFile(join(outputDir, "bin", scriptName), "#!/usr/bin/env bash\n");
    await link(join(outputDir, "bin", scriptName), join(homeDir, ".local", "bin", scriptName));
  }

  await link(
    join(outputDir, "opencode", "opencode.jsonc"),
    join(environment.XDG_CONFIG_HOME ?? "", "opencode", "opencode.jsonc"),
  );
  await link(join(outputDir, "claude-code", "CLAUDE.md"), join(claudeHome, "CLAUDE.md"));
  await link(join(outputDir, "claude-code", "settings.json"), join(claudeHome, "settings.json"));
  await link(join(outputDir, "pi", "APPEND_SYSTEM.md"), join(piHome, "APPEND_SYSTEM.md"));
}

describe("smokeBootstrapCommand", () => {
  let root: string;
  let runs: Array<{ repositoryDir: string; home: string | undefined }>;
  let logLines: string[];

  function recordingRunner(runner: ISmokeBootstrapRunner): ISmokeBootstrapRunner {
    return async (repositoryDir, environment) => {
      runs.push({ repositoryDir, home: environment.HOME });
      await runner(repositoryDir, environment);
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
    const smokeRun = { repositoryDir: join(smokeHome, "development", "ai-registry"), home: smokeHome };
    expect(runs).toEqual([smokeRun, smokeRun]);
    expect(await Bun.file(join(smokeHome, "development", "ai-registry", "package.json")).text()).toBe("{}\n");
    expect(logLines.at(-2)).toBe("\nBootstrap smoke test passed.");
  });

  it("fails when bootstrap replaces a home with a symlink", async () => {
    const symlinkingRunner: ISmokeBootstrapRunner = async (repositoryDir, environment) => {
      await emulateBootstrap(repositoryDir, environment);
      const claudeHome = join(environment.HOME ?? "", ".claude");
      await rm(claudeHome, { recursive: true, force: true });
      await symlink(join(repositoryDir, ".output", "claude-code"), claudeHome);
    };

    await expect(smokeBootstrapCommand({ root, runBootstrap: symlinkingRunner })).rejects.toThrow(
      `Expected a real directory at: ${join(root, ".tmp", "bootstrap-smoke", ".claude")}`,
    );
  });

  it("fails when bootstrap discards existing runtime data", async () => {
    const discardingRunner: ISmokeBootstrapRunner = async (repositoryDir, environment) => {
      await rm(join(environment.XDG_CONFIG_HOME ?? "", "opencode", "existing.txt"), { force: true });
      await emulateBootstrap(repositoryDir, environment);
    };

    await expect(smokeBootstrapCommand({ root, runBootstrap: discardingRunner })).rejects.toThrow(
      `Expected file to exist: ${join(root, ".tmp", "bootstrap-smoke", ".config", "opencode", "existing.txt")}`,
    );
  });
});
