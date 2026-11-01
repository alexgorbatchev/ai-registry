import { cp } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

// The repository root, so tests behave the same from any working directory.
export const REPOSITORY_ROOT = resolve(import.meta.dir, "..", "..", "..", "..", "..");

// Upstream source checkouts and documentation snapshots the build never reads.
const UNUSED_HARNESS_DIR_NAMES = new Set([".tmp", "docs"]);

// Builds write harness settings edits back into their source, so tests build from a
// private copy of the repository's harnesses instead of the real directory.
export async function copyRepositoryHarnesses(targetDir: string): Promise<void> {
  await cp(join(REPOSITORY_ROOT, "system"), join(dirname(targetDir), "system"), { recursive: true });
  await cp(join(REPOSITORY_ROOT, "harnesses"), targetDir, {
    recursive: true,
    filter: (sourcePath) => !UNUSED_HARNESS_DIR_NAMES.has(basename(sourcePath)),
  });
}

// Minimal isolated inputs for build integration tests; no user configuration is read.
export async function seedRegistry(root: string): Promise<import("../../lib/getRegistryPaths").IRegistryPaths> {
  const paths = {
    root, overlays: [], harnesses: join(root, "harnesses"), skills: join(root, "skills"),
    commands: join(root, "commands"), output: join(root, ".output"), temp: join(root, ".tmp"),
  };
  await Bun.write(join(paths.harnesses, "codex/config.toml"), 'model = "test"\n');
  await Bun.write(join(paths.harnesses, "pi/settings.json"), '{}\n');
  for (const name of ["install", "uninstall", "update"]) {
    await Bun.write(join(paths.harnesses, `pi/templates/pi-${name}.sh`), '#!/bin/sh\n');
  }
  return paths;
}

export async function createHarnessContext(root: string, target: string): Promise<import("../../lib/harnessBuild").IHarnessBuildContext> {
  const { copyDirectoryWithTemplateVariables, copyPathWithTemplateVariables, writeBinScript } = await import("../../lib/harnessBuild");
  const { resolveMatchedAssets } = await import("../../lib/resolveRegistryAssets");
  const { createSettingsSyncRegistry } = await import("../../lib/settingsSync/createSettingsSyncRegistry");
  const harnessDir = join(root, "harnesses", target);
  const outputDir = join(root, ".output");
  return {
    harnessDirs: [harnessDir],
    skills: await resolveMatchedAssets(["*"], join(root, "skills"), [join(harnessDir, "skills")]),
    commands: await resolveMatchedAssets(["*.md"], join(root, "commands")),
    outputDir, templateContext: { repo_root: root, output_dir: outputDir, skills_dir: join(root, "skills"), commands_dir: join(root, "commands") },
    buildSupport: { copyDirectoryWithTemplateVariables, copyPathWithTemplateVariables, writeBinScript,
      syncSettingsFile: createSettingsSyncRegistry(outputDir).syncSettingsFile },
  };
}
