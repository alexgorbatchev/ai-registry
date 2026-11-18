import { existsSync } from "fs";
import { join } from "path";

import { getHarnessSkillsDirs, type IHarnessBuildContext } from "./harnessBuild";
import { readHarnessSkillEntries } from "./userSkillUtils";

export async function logHarnessSkillOverrides(
  context: IHarnessBuildContext,
  targetName: string,
  logger: (message: string) => void = console.log,
): Promise<string[]> {
  const globalSkillsDir = context.templateContext.skills_dir;
  const overlaySkillsDirs = (context.overlayDirs ?? []).map((overlay) => join(overlay, "skills"));

  const harnessSkillEntries = (
    await Promise.all(getHarnessSkillsDirs(context).map((skillsDir) => readHarnessSkillEntries(skillsDir)))
  ).flat();
  const overriddenSkills = new Set<string>();

  for (const entry of harnessSkillEntries) {
    const isOverridingGlobal =
      existsSync(join(globalSkillsDir, "agent", entry.name)) ||
      existsSync(join(globalSkillsDir, "user", entry.name)) ||
      existsSync(join(globalSkillsDir, entry.name));
    const isOverridingOverlay = overlaySkillsDirs.some(
      (overlaySkillsDir) =>
        existsSync(join(overlaySkillsDir, "agent", entry.name)) ||
        existsSync(join(overlaySkillsDir, "user", entry.name)) ||
        existsSync(join(overlaySkillsDir, entry.name)),
    );

    if (isOverridingGlobal || isOverridingOverlay) {
      overriddenSkills.add(entry.name);
    }
  }

  const sortedSkills = [...overriddenSkills].sort((left, right) => left.localeCompare(right));

  if (sortedSkills.length > 0) {
    logger(`   ↳ ${targetName} skill overrides (${sortedSkills.length}): ${sortedSkills.join(", ")}`);
  }

  return sortedSkills;
}
