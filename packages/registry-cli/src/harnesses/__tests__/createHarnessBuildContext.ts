import { join } from "node:path";

import {
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
  mergeDirectory,
  stageHarnessSkills,
  stageRegistryAssets,
  writeBinScript,
  type IHarnessBuildContext,
} from "../../lib/harnessBuild";
import {
  createSettingsSyncRegistry,
  type ISettingsSyncRegistry,
} from "../../lib/settingsSync/createSettingsSyncRegistry";

export type IHarnessBuildContextOptions = {
  skills?: string[];
  commands?: string[];
  commandSourcePaths?: Record<string, string>;
  settingsSyncRegistry?: ISettingsSyncRegistry;
  // Records each staged file's source, as the real build does for sync-back.
  sourcePathByOutputPath?: Map<string, string>;
};

// Builds one harness from `<repositoryRoot>/harnesses/<target>` into
// `<repositoryRoot>/.output`, resolving registry assets from `skills/` and `commands/`.
export function createHarnessBuildContext(
  repositoryRoot: string,
  target: string,
  options: IHarnessBuildContextOptions = {},
): IHarnessBuildContext {
  const outputDir = join(repositoryRoot, ".output");
  const settingsSyncRegistry = options.settingsSyncRegistry ?? createSettingsSyncRegistry(outputDir);
  const { sourcePathByOutputPath } = options;
  return {
    harnessDir: join(repositoryRoot, "harnesses", target),
    overlayDirs: [],
    outputDir,
    systemPromptPath: join(repositoryRoot, "system", "system.md"),
    assets: {
      skills: options.skills ?? [],
      skillSourcePaths: {},
      userSkillNames: new Set(),
      commands: options.commands ?? [],
      commandSourcePaths: options.commandSourcePaths ?? {},
    },
    templateContext: {
      commands_dir: join(repositoryRoot, "commands"),
      output_dir: outputDir,
      repo_root: repositoryRoot,
      skills_dir: join(repositoryRoot, "skills"),
    },
    buildSupport: {
      mergeDirectory: (sourceDir, targetDir, mergeOptions) =>
        mergeDirectory(sourceDir, targetDir, mergeOptions, sourcePathByOutputPath),
      stageHarnessSkills,
      stageRegistryAssets,
      writeBinScript,
      copyDirectoryWithTemplateVariables: (sourceDir, targetDir) =>
        copyDirectoryWithTemplateVariables(sourceDir, targetDir, sourcePathByOutputPath),
      copyPathWithTemplateVariables: (sourcePath, targetPath) =>
        copyPathWithTemplateVariables(sourcePath, targetPath, sourcePathByOutputPath),
      syncSettingsFile: settingsSyncRegistry.syncSettingsFile,
    },
  };
}
