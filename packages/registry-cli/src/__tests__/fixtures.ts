import { afterAll, onTestFinished } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { join, resolve } from "node:path";

const directories = new Set<string>();
const parents = new Set<string>();

function removeDirectory(directory: string): void {
  rmSync(directory, { recursive: true, force: true });
  directories.delete(directory);
  for (const parent of parents) {
    try {
      rmdirSync(parent);
      parents.delete(parent);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && ["ENOTEMPTY", "ENOENT"].includes(String(error.code)))) {
        throw error;
      }
    }
  }
}

process.on("exit", () => {
  for (const directory of directories) removeDirectory(directory);
});

function createDirectory(name: string): string {
  const parent = process.env.REGISTRY_TEST_TMPDIR ?? resolve(import.meta.dir, "../../../../.tmp");
  const created = mkdirSync(parent, { recursive: true });
  if (created) parents.add(created);
  const directory = mkdtempSync(join(parent, `${name}-`));
  directories.add(directory);
  return directory;
}

export function factory_testRoot(name: string): string {
  const directory = createDirectory(name);
  afterAll(() => removeDirectory(directory));
  return directory;
}

export function factory_testDirectory(name: string): string {
  const directory = createDirectory(name);
  onTestFinished(() => removeDirectory(directory));
  return directory;
}
