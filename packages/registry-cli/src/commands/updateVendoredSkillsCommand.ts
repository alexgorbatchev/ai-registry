import { $ } from "bun";
import { readFile } from "fs/promises";
import { join } from "path";
import { getRegistryPaths } from "../lib/getRegistryPaths";

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
  }
}
