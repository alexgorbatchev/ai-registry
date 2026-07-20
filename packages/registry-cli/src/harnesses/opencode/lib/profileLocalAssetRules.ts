type ISkillPermission = Record<string, string>;

export function createSkillPermission(
  globalMatchedSkills: string[],
  profileLocalSkills: string[],
  harnessName?: string,
): ISkillPermission {
  const permission: ISkillPermission = { "*": "deny" };

  if (harnessName) {
    permission[`${harnessName}-*`] = "allow";
  }

  for (const globalMatchedSkill of globalMatchedSkills) {
    permission[globalMatchedSkill] = "allow";
  }

  for (const profileLocalSkill of profileLocalSkills) {
    permission[profileLocalSkill] = "allow";
  }

  return permission;
}
