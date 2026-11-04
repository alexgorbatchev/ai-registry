import { cp } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

// The repository root, so tests behave the same from any working directory.
export const REPOSITORY_ROOT = resolve(import.meta.dir, "..", "..", "..", "..", "..");

// Upstream source checkouts and documentation snapshots the build never reads.
const UNUSED_HARNESS_DIR_NAMES = new Set([".tmp", "docs"]);

// Builds write harness settings edits back into their source, so tests build from a
// private copy of the repository's harnesses instead of the real directory.
export async function copyRepositoryHarnesses(targetDir: string): Promise<void> {
  await cp(join(REPOSITORY_ROOT, "harnesses"), targetDir, {
    recursive: true,
    filter: (sourcePath) => !UNUSED_HARNESS_DIR_NAMES.has(basename(sourcePath)),
  });
}

// Stands in for the user's login shell, so builds never read real keys during tests.
export function loadTestShellEnvironment(): Record<string, string> {
  return { LGLLM_API_URL: "https://llm.example.invalid/v1", LGLLM_API_KEY: "test-key" };
}
