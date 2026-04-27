import { $ } from "bun";
import { cp, lstat, mkdir, readdir, realpath, rm, writeFile } from "fs/promises";
import { join, resolve } from "path";

const REGISTRY_DIR = resolve(import.meta.dir, "..");
const SMOKE_HOME = join(REGISTRY_DIR, ".tmp", "bootstrap-smoke");
const SMOKE_REPO_DIR = join(SMOKE_HOME, "development", "ai-registry");
const CONFIG_HOME = join(SMOKE_HOME, ".config");
const PUBLIC_BIN_DIR = join(SMOKE_HOME, ".local", "bin");
const OPENCODE_TARGET = join(CONFIG_HOME, "opencode");
const OPENCODE_SOURCE = join(SMOKE_REPO_DIR, ".output", "opencode");
const PI_TARGET = join(SMOKE_HOME, ".pi", "agent");
const PI_SOURCE = join(SMOKE_REPO_DIR, ".output", "pi", "profiles", "default");
const PUBLIC_SCRIPT_NAMES = [
  "air-opencode-conversation-extract",
  "air-opencode-session-analysis",
  "air-opencode-session-export",
];
const OUTPUT_MANIFEST = join(
  SMOKE_REPO_DIR,
  ".output",
  "manifest.json",
);

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

async function findSingleBackup(parentDir: string, prefix: string): Promise<string> {
  const entries = await readdir(parentDir, { withFileTypes: true });
  const matches = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => join(parentDir, entry.name));

  if (matches.length !== 1) {
    fail(`Expected exactly one backup matching ${prefix} in ${parentDir}, found ${matches.length}`);
  }

  return matches[0];
}

async function seedExistingTargets(): Promise<void> {
  await mkdir(OPENCODE_TARGET, { recursive: true });
  await writeFile(join(OPENCODE_TARGET, "existing.txt"), "existing opencode data\n");

  await mkdir(PI_TARGET, { recursive: true });
  await writeFile(join(PI_TARGET, "existing.txt"), "existing pi data\n");
}

async function createSmokeClone(): Promise<void> {
  await mkdir(SMOKE_REPO_DIR, { recursive: true });

  const rootEntries = await readdir(REGISTRY_DIR, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (EXCLUDED_ROOT_ENTRIES.has(entry.name)) {
      continue;
    }

    await cp(join(REGISTRY_DIR, entry.name), join(SMOKE_REPO_DIR, entry.name), {
      recursive: true,
    });
  }
}

async function runBootstrap(): Promise<void> {
  await $`bun run bootstrap`
    .cwd(SMOKE_REPO_DIR)
    .env({
      ...process.env,
      HOME: SMOKE_HOME,
      XDG_CONFIG_HOME: CONFIG_HOME,
    });
}

async function runBootstrapWithPiProfile(): Promise<void> {
  await $`bun run bootstrap -- --pi-profile default`
    .cwd(SMOKE_REPO_DIR)
    .env({
      ...process.env,
      HOME: SMOKE_HOME,
      PI_CODING_AGENT_DIR: PI_TARGET,
      XDG_CONFIG_HOME: CONFIG_HOME,
    });
}

async function verifyBootstrapOutputs(): Promise<void> {
  const opencodeBackupDir = await findSingleBackup(CONFIG_HOME, "opencode.backup-");
  const publicScriptAssertions = PUBLIC_SCRIPT_NAMES.map((scriptName) =>
    assertSymlinkTarget(join(PUBLIC_BIN_DIR, scriptName), join(SMOKE_REPO_DIR, "scripts", scriptName)),
  );

  await Promise.all([
    assertPathExists(join(opencodeBackupDir, "existing.txt")),
    assertPathExists(OUTPUT_MANIFEST),
    assertSymlinkTarget(OPENCODE_TARGET, OPENCODE_SOURCE),
    ...publicScriptAssertions,
  ]);
}

async function verifyPiBootstrapOutputs(): Promise<void> {
  const piBackupDir = await findSingleBackup(join(SMOKE_HOME, ".pi"), "agent.backup-");

  await Promise.all([
    assertPathExists(join(piBackupDir, "existing.txt")),
    assertSymlinkTarget(PI_TARGET, PI_SOURCE),
  ]);
}

async function main(): Promise<void> {
  console.log("🚬 Running bootstrap smoke test...\n");

  await rm(SMOKE_HOME, { recursive: true, force: true });
  await createSmokeClone();
  await seedExistingTargets();

  console.log(`Using fake HOME: ${SMOKE_HOME}`);
  console.log(`Using smoke repo clone: ${SMOKE_REPO_DIR}`);
  console.log("First bootstrap run: backup existing directories, link generated outputs, and sync public scripts.");
  await runBootstrap();
  await verifyBootstrapOutputs();

  console.log("Second bootstrap run: verify idempotent reuse of managed symlinks.");
  await runBootstrap();
  await verifyBootstrapOutputs();

  console.log("Third bootstrap run: verify optional Pi profile linking.");
  await runBootstrapWithPiProfile();
  await verifyPiBootstrapOutputs();

  console.log("\nBootstrap smoke test passed.");
  console.log(`Inspect artifacts at: ${SMOKE_HOME}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
