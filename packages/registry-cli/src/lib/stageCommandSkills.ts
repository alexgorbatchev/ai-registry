import { existsSync } from "fs";
import { join } from "path";

import { getCommandSkillName } from "./getCommandSkillName";
import type { IHarnessBuildContext } from "./harnessBuild";

// Packages every registry command as a native skill bundle `<skillsDir>/<name>/SKILL.md`
// holding the command content, for harnesses that have skills but no command files.
// `finishSkill` then marks each bundle explicit-invocation-only in the harness's own
// way. Staging goes through `stageSourcePath`, so templates resolve once and generated
// edits recover into the command source.
export async function stageCommandSkills(
  context: IHarnessBuildContext,
  skillsDir: string,
  harnessLabel: string,
  finishSkill: (skillDir: string) => Promise<void>,
): Promise<void> {
  const commandSkillNames = new Set<string>();
  for (const command of context.assets.commands) {
    const sourcePath =
      context.assets.commandSourcePaths[command] ?? join(context.templateContext.commands_dir, command);
    const skillName = getCommandSkillName(command, await Bun.file(sourcePath).text(), harnessLabel);
    if (commandSkillNames.has(skillName)) {
      throw new Error(`Duplicate ${harnessLabel} command skill name: ${skillName}`);
    }
    commandSkillNames.add(skillName);

    const skillDir = join(skillsDir, skillName);
    if (existsSync(skillDir)) {
      throw new Error(`${harnessLabel} command skill ${skillName} collides with a skill of the same name.`);
    }

    await context.buildSupport.stageSourcePath(sourcePath, join(skillDir, "SKILL.md"));
    await finishSkill(skillDir);
  }
}
