import { existsSync } from "fs";
import { join } from "path";

import type { IUnifiedHarnessBuildContext } from "./harnessBuild";
import { readHarnessSkillEntries } from "./userSkillUtils";

export async function logHarnessSkillOverrides(
  context: IUnifiedHarnessBuildContext,
  targetName: string,
  logger: (message: string) => void = console.log,
): Promise<string[]> {
  const harnessSkillsDir = join(context.harnessDir, "skills");
  if (!existsSync(harnessSkillsDir)) {
    return [];
  }

  const globalSkillsDir = context.templateContext.skills_dir;
  const overlaySkillsDir = context.templateContext.overlay_dir
    ? join(context.templateContext.overlay_dir, "skills")
    : null;

  const harnessSkillEntries = await readHarnessSkillEntries(harnessSkillsDir);
  const overriddenSkills: string[] = [];

  for (const entry of harnessSkillEntries) {

    const isOverridingGlobal =
      existsSync(join(globalSkillsDir, "agent", entry.name)) ||
      existsSync(join(globalSkillsDir, "user", entry.name)) ||
      existsSync(join(globalSkillsDir, entry.name));
    const isOverridingOverlay = overlaySkillsDir
      ? existsSync(join(overlaySkillsDir, "agent", entry.name)) ||
        existsSync(join(overlaySkillsDir, "user", entry.name)) ||
        existsSync(join(overlaySkillsDir, entry.name))
      : false;

    if (isOverridingGlobal || isOverridingOverlay) {
      overriddenSkills.push(entry.name);
    }
  }

  overriddenSkills.sort((left, right) => left.localeCompare(right));

  if (overriddenSkills.length > 0) {
    logger(`   ↳ ${targetName} skill overrides (${overriddenSkills.length}): ${overriddenSkills.join(", ")}`);
  }

  return overriddenSkills;
}
