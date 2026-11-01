import { cp, lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from "fs/promises";
import { join } from "path";
import { getRegistryPaths } from "../lib/getRegistryPaths";
import { runCommand } from "../lib/runCommand";

// Runs `bun run bootstrap -- <arguments>` in the smoke clone with the given environment.
export type ISmokeBootstrapRunner = (
  repositoryDir: string,
  bootstrapArguments: string[],
  environment: NodeJS.ProcessEnv,
) => Promise<void>;

export type ISmokeBootstrapDependencies = {
  root: string;
  runBootstrap: ISmokeBootstrapRunner;
};

const PUBLIC_SCRIPT_NAMES = [
  "air-opencode-conversation-extract",
  "air-opencode-session-analysis",
  "air-opencode-session-export",
];

const EXCLUDED_ROOT_ENTRIES = new Set([
  ".agents",
  ".git",
  ".output",
  ".tmp",
  "node_modules",
]);

function fail(message: string): never {
  throw new Error(message);
}

async function assertPathExists(path: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    fail(`Expected path to exist: ${path}`);
  }
}

async function assertSymlinkTarget(linkPath: string, expectedTarget: string): Promise<void> {
  const linkStats = await lstat(linkPath);
  if (!linkStats.isSymbolicLink()) {
    fail(`Expected symlink at: ${linkPath}`);
  }
  const [resolvedLinkPath, resolvedExpectedTarget] = await Promise.all([realpath(linkPath), realpath(expectedTarget)]);
  if (resolvedLinkPath !== resolvedExpectedTarget) {
    fail(`Symlink ${linkPath} does not point to ${expectedTarget}`);
  }
}

async function assertRealDirectory(path: string): Promise<void> {
  const stats = await lstat(path);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail(`Expected a real directory at: ${path}`);
  }
}

async function assertFileContent(path: string, expectedContent: string): Promise<void> {
  const content = await readFile(path, "utf-8").catch(() => fail(`Expected file to exist: ${path}`));
  if (content !== expectedContent) {
    fail(`Unexpected content in: ${path}`);
  }
}

async function assertNoBackups(parentDir: string, prefix: string): Promise<void> {
  const entries = await readdir(parentDir);
  if (entries.some((entry) => entry.startsWith(prefix))) {
    fail(`Expected no ${prefix}* backups in ${parentDir}`);
  }
}

async function runRealBootstrap(
  repositoryDir: string,
  bootstrapArguments: string[],
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  await runCommand({
    cmd: bootstrapArguments.length === 0 ? ["bun", "run", "bootstrap"] : ["bun", "run", "bootstrap", "--", ...bootstrapArguments],
    cwd: repositoryDir,
    env: environment,
    description: "run bootstrap in the smoke clone",
  });
}

export async function smokeBootstrapCommand(
  dependencies: ISmokeBootstrapDependencies = { root: getRegistryPaths().root, runBootstrap: runRealBootstrap },
): Promise<void> {
  const { root } = dependencies;

  const SMOKE_HOME = join(root, ".tmp", "bootstrap-smoke");
  const SMOKE_REPO_DIR = join(SMOKE_HOME, "development", "ai-registry");
  const CONFIG_HOME = join(SMOKE_HOME, ".config");
  const DATA_HOME = join(SMOKE_HOME, ".local", "share");
  const PUBLIC_BIN_DIR = join(SMOKE_HOME, ".local", "bin");
  const OPENCODE_TARGET = join(CONFIG_HOME, "opencode");
  const OPENCODE_SOURCE = join(SMOKE_REPO_DIR, ".output", "opencode");
  const PI_TARGET = join(SMOKE_HOME, ".pi", "agent");
  const PI_SOURCE = join(SMOKE_REPO_DIR, ".output", "pi");
  const CLAUDE_CODE_TARGET = join(SMOKE_HOME, ".claude");
  const CLAUDE_CODE_SOURCE = join(SMOKE_REPO_DIR, ".output", "claude-code");
  const OUTPUT_MANIFEST = join(SMOKE_REPO_DIR, ".output", "manifest.json");

  async function seedExistingTargets(): Promise<void> {
    await mkdir(OPENCODE_TARGET, { recursive: true });
    await writeFile(join(OPENCODE_TARGET, "existing.txt"), "existing opencode data\n");
    await mkdir(join(SMOKE_HOME, ".codex"), { recursive: true });
    await writeFile(join(SMOKE_HOME, ".codex", "existing.txt"), "existing codex data\n");
    await mkdir(PI_TARGET, { recursive: true });
    await writeFile(join(PI_TARGET, "existing.txt"), "existing pi data\n");
    await mkdir(CLAUDE_CODE_TARGET, { recursive: true });
    await writeFile(join(CLAUDE_CODE_TARGET, "existing.txt"), "existing claude code data\n");
  }

  async function createSmokeClone(): Promise<void> {
    await mkdir(SMOKE_REPO_DIR, { recursive: true });
    const rootEntries = await readdir(root, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (EXCLUDED_ROOT_ENTRIES.has(entry.name)) {
        continue;
      }
      await cp(join(root, entry.name), join(SMOKE_REPO_DIR, entry.name), {
        recursive: true,
      });
    }
  }

  const SMOKE_ENVIRONMENT: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: SMOKE_HOME,
    XDG_CONFIG_HOME: CONFIG_HOME,
    XDG_DATA_HOME: DATA_HOME,
    CODEX_HOME: join(SMOKE_HOME, ".codex"),
    CLAUDE_CONFIG_DIR: CLAUDE_CODE_TARGET,
    PI_CODING_AGENT_DIR: PI_TARGET,
    OPENCODE_CONFIG_DIR: OPENCODE_TARGET,
    AI_REGISTRY_OVERLAY: "",
    AI_REGISTRY_SETTINGS_AUTO_COMMIT: "0",
  };

  async function runBootstrap(): Promise<void> {
    await dependencies.runBootstrap(SMOKE_REPO_DIR, [], SMOKE_ENVIRONMENT);
  }

  // Harness homes stay real directories: existing runtime data remains in place and
  // only the generated entries are linked in.
  async function verifyBootstrapOutputs(): Promise<void> {
    await assertPathExists(OUTPUT_MANIFEST);
    await assertRealDirectory(join(SMOKE_HOME, ".codex"));
    await assertFileContent(join(SMOKE_HOME, ".codex", "existing.txt"), "existing codex data\n");
    await assertSymlinkTarget(join(SMOKE_HOME, ".codex", "config.toml"), join(SMOKE_REPO_DIR, ".output", "codex", "config.toml"));
    await assertRealDirectory(OPENCODE_TARGET);
    await assertFileContent(join(OPENCODE_TARGET, "existing.txt"), "existing opencode data\n");
    await assertSymlinkTarget(join(OPENCODE_TARGET, "opencode.jsonc"), join(OPENCODE_SOURCE, "opencode.jsonc"));
    await assertNoBackups(CONFIG_HOME, "opencode.backup-");
    await assertRealDirectory(CLAUDE_CODE_TARGET);
    await assertFileContent(join(CLAUDE_CODE_TARGET, "existing.txt"), "existing claude code data\n");
    await assertSymlinkTarget(join(CLAUDE_CODE_TARGET, "CLAUDE.md"), join(CLAUDE_CODE_SOURCE, "CLAUDE.md"));
    await assertSymlinkTarget(join(CLAUDE_CODE_TARGET, "settings.json"), join(CLAUDE_CODE_SOURCE, "settings.json"));
    await assertNoBackups(SMOKE_HOME, ".claude.backup-");
    for (const scriptName of PUBLIC_SCRIPT_NAMES) {
      await assertSymlinkTarget(join(PUBLIC_BIN_DIR, scriptName), join(SMOKE_REPO_DIR, ".output", "bin", scriptName));
    }
  }

  async function verifyPiBootstrapOutputs(): Promise<void> {
    await assertRealDirectory(PI_TARGET);
    await assertFileContent(join(PI_TARGET, "existing.txt"), "existing pi data\n");
    await assertSymlinkTarget(join(PI_TARGET, "APPEND_SYSTEM.md"), join(PI_SOURCE, "APPEND_SYSTEM.md"));
    await assertNoBackups(join(SMOKE_HOME, ".pi"), "agent.backup-");
  }

  console.log("🚬 Running bootstrap smoke test...\n");
  await rm(SMOKE_HOME, { recursive: true, force: true });
  await createSmokeClone();
  await seedExistingTargets();

  console.log(`Using fake HOME: ${SMOKE_HOME}`);
  console.log(`Using smoke repo clone: ${SMOKE_REPO_DIR}`);
  console.log("First bootstrap run: keep existing home data, link generated entries, and sync public scripts.");
  await runBootstrap();
  await verifyBootstrapOutputs();
  await verifyPiBootstrapOutputs();

  console.log("Second bootstrap run: verify idempotent reuse of managed links.");
  await runBootstrap();
  await verifyBootstrapOutputs();

  console.log("\nBootstrap smoke test passed.");
  console.log(`Inspect artifacts at: ${SMOKE_HOME}`);
}
