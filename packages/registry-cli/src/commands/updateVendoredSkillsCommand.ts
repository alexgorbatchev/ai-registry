import { $ } from "bun";
import { existsSync } from "fs";
import { readFile, rename, rm, writeFile } from "fs/promises";
import { join } from "path";
import { getRegistryPaths } from "../lib/getRegistryPaths";
import { removeDisableModelInvocation } from "../lib/userSkillUtils";

type IVendoredSkillEntry = {
  source: string;
  ref?: string;
  sourceType?: string;
};

type IVendoredSkillLock = {
  version: number;
  skills: Record<string, IVendoredSkillEntry>;
};

function getRequestedSkillNames(): string[] {
  return process.argv.slice(2).map((skillName) => skillName.trim()).filter(Boolean);
}

function buildInstallSource(entry: IVendoredSkillEntry): string {
  if (!entry.ref) {
    return entry.source;
  }
  return `${entry.source}#${entry.ref}`;
}

async function readVendoredSkillLock(lockPath: string): Promise<IVendoredSkillLock> {
  const fileContents = await readFile(lockPath, "utf-8");
  const parsed = JSON.parse(fileContents) as Partial<IVendoredSkillLock>;

  if (!parsed.skills || typeof parsed.skills !== "object") {
    throw new Error(`Invalid vendored skill lock: ${lockPath}`);
  }

  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    skills: parsed.skills as Record<string, IVendoredSkillEntry>,
  };
}

async function relocateUpdatedSkill(root: string, skillName: string): Promise<void> {
  const flatPath = join(root, "skills", skillName);
  if (!existsSync(flatPath)) {
    return;
  }

  const userDir = join(root, "skills", "user", skillName);
  const isExistingUser = existsSync(userDir);

  const skillFile = join(flatPath, "SKILL.md");
  let isUserSkill = isExistingUser;
  if (existsSync(skillFile)) {
    const content = await readFile(skillFile, "utf-8");
    if (content.includes("disable-model-invocation: true")) {
      isUserSkill = true;
    }
    if (isUserSkill) {
      const stripped = removeDisableModelInvocation(content);
      await writeFile(skillFile, stripped, "utf-8");
    }
  }

  const targetGroup = isUserSkill ? "user" : "agent";
  const targetDir = join(root, "skills", targetGroup, skillName);
  await rm(targetDir, { recursive: true, force: true });
  await rename(flatPath, targetDir);
}

export async function updateVendoredSkillsCommand(): Promise<void> {
  const { root } = getRegistryPaths();
  const lockPath = join(root, "skills-lock.json");
  
  const requestedSkillNames = getRequestedSkillNames();
  const vendoredSkillLock = await readVendoredSkillLock(lockPath);
  const vendoredSkills = Object.entries(vendoredSkillLock.skills).filter(([skillName]) => {
    return requestedSkillNames.length === 0 || requestedSkillNames.includes(skillName);
  });

  if (vendoredSkills.length === 0) {
    if (requestedSkillNames.length > 0) {
      throw new Error(`No vendored skills found matching: ${requestedSkillNames.join(", ")}`);
    }
    console.log("No vendored external skills recorded in skills-lock.json.");
    return;
  }

  console.log(`Refreshing ${vendoredSkills.length} vendored external skill(s)...`);

  for (const [skillName, entry] of vendoredSkills) {
    const installSource = buildInstallSource(entry);
    console.log(`\nUpdating ${skillName} from ${installSource}`);
    await $`npx skills add ${installSource} --skill ${skillName} -a openclaw --copy -y`.cwd(root);
    await relocateUpdatedSkill(root, skillName);
  }
}
