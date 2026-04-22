type ISkillPermission = Record<string, string>;

function isGlobalWildcardOnly(manifestSkills: string[] | undefined): boolean {
  return Array.isArray(manifestSkills) && manifestSkills.length === 1 && manifestSkills[0] === "*";
}

export function createSkillPermission(
  manifestSkills: string[] | undefined,
  globalMatchedSkills: string[],
  profileLocalSkills: string[],
): ISkillPermission {
  if (isGlobalWildcardOnly(manifestSkills) && profileLocalSkills.length === 0) {
    return { "*": "allow" };
  }

  const permission: ISkillPermission = { "*": "deny" };
  for (const profileLocalSkill of profileLocalSkills) {
    permission[profileLocalSkill] = "allow";
  }

  for (const globalMatchedSkill of globalMatchedSkills) {
    permission[globalMatchedSkill] = "allow";
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
