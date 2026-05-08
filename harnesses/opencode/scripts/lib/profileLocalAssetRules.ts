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
