import { $ } from "bun";
import { cp, lstat, mkdir, readdir, realpath, rm, writeFile } from "fs/promises";
import { join, resolve } from "path";

const REGISTRY_DIR = resolve(import.meta.dir, "..");
const SMOKE_HOME = join(REGISTRY_DIR, ".tmp", "bootstrap-smoke");
const SMOKE_REPO_DIR = join(SMOKE_HOME, "development", "ai-registry");
const CONFIG_HOME = join(SMOKE_HOME, ".config");
const OPENCODE_TARGET = join(CONFIG_HOME, "opencode");
const OPENCODE_SOURCE = join(SMOKE_REPO_DIR, ".output", "opencode");

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

async function verifyBootstrapOutputs(): Promise<void> {
  const opencodeBackupDir = await findSingleBackup(CONFIG_HOME, "opencode.backup-");

  await Promise.all([
    assertPathExists(join(opencodeBackupDir, "existing.txt")),
    assertSymlinkTarget(OPENCODE_TARGET, OPENCODE_SOURCE),
  ]);
}

async function main(): Promise<void> {
  console.log("🚬 Running bootstrap smoke test...\n");

  await rm(SMOKE_HOME, { recursive: true, force: true });
  await createSmokeClone();
  await seedExistingTargets();

  console.log(`Using fake HOME: ${SMOKE_HOME}`);
  console.log(`Using smoke repo clone: ${SMOKE_REPO_DIR}`);
  console.log("First bootstrap run: backup existing directories and link generated outputs.");
  await runBootstrap();
  await verifyBootstrapOutputs();

  console.log("Second bootstrap run: verify idempotent reuse of managed symlinks.");
  await runBootstrap();
  await verifyBootstrapOutputs();

  console.log("\nBootstrap smoke test passed.");
  console.log(`Inspect artifacts at: ${SMOKE_HOME}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
