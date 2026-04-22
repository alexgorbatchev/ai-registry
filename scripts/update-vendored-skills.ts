import { $ } from "bun";
import { readFile } from "fs/promises";
import { join, resolve } from "path";

const REGISTRY_DIR = resolve(import.meta.dir, "..");
const SKILLS_LOCK_PATH = join(REGISTRY_DIR, "skills-lock.json");

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

async function readVendoredSkillLock(): Promise<IVendoredSkillLock> {
  const fileContents = await readFile(SKILLS_LOCK_PATH, "utf-8");
  const parsed = JSON.parse(fileContents) as Partial<IVendoredSkillLock>;

  if (!parsed.skills || typeof parsed.skills !== "object") {
    throw new Error(`Invalid vendored skill lock: ${SKILLS_LOCK_PATH}`);
  }

  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    skills: parsed.skills as Record<string, IVendoredSkillEntry>,
  };
}

async function main(): Promise<void> {
  const requestedSkillNames = getRequestedSkillNames();
  const vendoredSkillLock = await readVendoredSkillLock();
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
    await $`npx skills add ${installSource} --skill ${skillName} -a openclaw --copy -y`.cwd(REGISTRY_DIR);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
