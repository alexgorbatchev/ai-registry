import { existsSync, type Dirent } from "fs";
import { readdir, readFile } from "fs/promises";
import { delimiter, join } from "path";

import { getErrorCode } from "../../lib/getErrorCode";
import { resolvePathWithHome } from "../../lib/getRegistryPaths";

export const CODEX_TRUSTED_DIRS_ENV = "AI_REGISTRY_CODEX_TRUSTED_DIRS";
const SKIPPED_DIRECTORY_NAMES = new Set(["node_modules"]);
const SUBMODULE_PATH_PATTERN = /^\s*path\s*=\s*(.+?)\s*$/gm;

async function readDirectoryEntries(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    // Unreadable folders hold nothing Codex can open either.
    if (getErrorCode(error) === "EACCES" || getErrorCode(error) === "EPERM") {
      return [];
    }
    throw error;
  }
}

async function readSubmodulePaths(checkoutDir: string): Promise<string[]> {
  const gitmodulesPath = join(checkoutDir, ".gitmodules");
  if (!existsSync(gitmodulesPath)) {
    return [];
  }
  const content = await readFile(gitmodulesPath, "utf-8");
  return [...content.matchAll(SUBMODULE_PATH_PATTERN)].map((match) => match[1] ?? "").filter(Boolean);
}

// Outside a checkout every visible folder is searched; inside one only the
// submodules it declares are, so build outputs and dependencies are never walked.
async function collectGitCheckouts(dir: string, checkouts: Set<string>): Promise<void> {
  const entries = await readDirectoryEntries(dir);
  if (entries.some((entry) => entry.name === ".git")) {
    checkouts.add(dir);
    for (const submodulePath of await readSubmodulePaths(dir)) {
      const submoduleDir = join(dir, submodulePath);
      if (existsSync(submoduleDir)) {
        await collectGitCheckouts(submoduleDir, checkouts);
      }
    }
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
      continue;
    }
    await collectGitCheckouts(join(dir, entry.name), checkouts);
  }
}

// Codex matches project trust by exact checkout path, so trusting a parent folder
// covers nothing beneath it. Expands a PATH-style list of folders into every git
// checkout they contain, including declared submodules at any depth.
export async function discoverTrustedProjects(trustedDirsValue: string, repositoryRoot: string): Promise<string[]> {
  const rootDirs = new Set(
    trustedDirsValue
      .split(delimiter)
      .filter((entry) => entry.trim())
      .map((entry) => resolvePathWithHome(entry, repositoryRoot)),
  );

  const checkouts = new Set<string>();
  for (const rootDir of rootDirs) {
    if (!existsSync(rootDir)) {
      console.warn(`⚠️ Trusted Codex folder does not exist: ${rootDir} (from ${CODEX_TRUSTED_DIRS_ENV})`);
      continue;
    }
    await collectGitCheckouts(rootDir, checkouts);
  }

  return [...checkouts].sort();
}
