import { $ } from "bun";
import { dirname, relative } from "path";

import { runGitleaks } from "../runGitleaks";
import type { ISettingsSourceRepository, SettingsSourceState } from "./types";

const COMMIT_SUBJECT = "chore(settings): sync harness settings";

async function getRepositoryRoot(filePath: string): Promise<string | null> {
  const result = await $`git rev-parse --show-toplevel`.cwd(dirname(filePath)).quiet().nothrow();
  return result.exitCode === 0 ? result.stdout.toString().trim() : null;
}

// Commits settings edits the build wrote back into registry sources, one commit
// per Git repository, without touching anything else that is staged.
export function createGitSettingsSourceRepository(): ISettingsSourceRepository {
  return {
    async getSourceState(sourcePath: string): Promise<SettingsSourceState> {
      const repositoryRoot = await getRepositoryRoot(sourcePath);
      if (repositoryRoot === null) return "unversioned";

      const tracked = await $`git ls-files --error-unmatch -- ${sourcePath}`.cwd(repositoryRoot).quiet().nothrow();
      if (tracked.exitCode !== 0) return "unversioned";

      const diff = await $`git diff --quiet HEAD -- ${sourcePath}`.cwd(repositoryRoot).quiet().nothrow();
      return diff.exitCode === 0 ? "clean" : "dirty";
    },
    async hasSecrets(sourcePath: string): Promise<boolean> {
      return (await runGitleaks(["dir", sourcePath], dirname(sourcePath))) === "leaks";
    },
    async commit(sourcePaths: string[]): Promise<void> {
      const pathsByRepository = new Map<string, string[]>();
      for (const sourcePath of sourcePaths) {
        const repositoryRoot = await getRepositoryRoot(sourcePath);
        if (repositoryRoot === null) {
          throw new Error(`Cannot commit synced settings: ${sourcePath} is not inside a Git repository.`);
        }
        pathsByRepository.set(repositoryRoot, [...(pathsByRepository.get(repositoryRoot) ?? []), sourcePath]);
      }

      for (const [repositoryRoot, repositoryPaths] of pathsByRepository) {
        const relativePaths = repositoryPaths.map((sourcePath) => relative(repositoryRoot, sourcePath));
        const body = `Write settings changed in the harness back to ${relativePaths.join(", ")}.`;
        await $`git commit --only --quiet -m ${COMMIT_SUBJECT} -m ${body} -- ${relativePaths}`.cwd(repositoryRoot).quiet();
      }
    },
  };
}
