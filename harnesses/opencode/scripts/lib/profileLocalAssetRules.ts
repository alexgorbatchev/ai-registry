type ISkillPermission = Record<string, string>;

export function createSkillPermission(
  globalMatchedSkills: string[],
  profileLocalSkills: string[],
): ISkillPermission {
  const permission: ISkillPermission = { "*": "deny" };

  for (const globalMatchedSkill of globalMatchedSkills) {
    permission[globalMatchedSkill] = "allow";
  }

  for (const profileLocalSkill of profileLocalSkills) {
    permission[profileLocalSkill] = "allow";
  }

  return permission;
}

export function getProfileLocalCommandOutputName(profileName: string, commandFileName: string): string {
  if (!commandFileName.endsWith(".md")) {
    throw new Error(`Profile-local commands must use .md filenames: ${commandFileName}`);
  }

  const commandBaseName = commandFileName.slice(0, -3);
  if (commandBaseName.startsWith("--")) {
    throw new Error(
      `Profile-local commands must not start with -- because the output name is namespaced automatically: ${commandFileName}`,
    );
  }

  return `--${profileName}-${commandFileName}`;
}
