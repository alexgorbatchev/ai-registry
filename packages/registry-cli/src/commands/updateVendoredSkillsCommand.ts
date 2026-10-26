import { readFile } from "fs/promises";
import { join } from "path";
import { getRegistryPaths } from "../lib/getRegistryPaths";
import { getObjectValue } from "../lib/harnessBuild";
import { runCommand } from "../lib/runCommand";
import { relocateVendoredSkill } from "../lib/vendoredSkillUtils";
import type { IVendoredSkillCommandDependencies } from "./addVendoredSkillCommand";

type IVendoredSkillEntry = {
  source: string;
  ref?: string;
  sourceType?: string;
};

type IVendoredSkillLock = {
  version: number;
  skills: Record<string, IVendoredSkillEntry>;
};

function getRequestedSkillNames(argv: string[]): string[] {
  return argv.slice(2).map((skillName) => skillName.trim()).filter(Boolean);
}

function buildInstallSource(entry: IVendoredSkillEntry): string {
  if (!entry.ref) {
    return entry.source;
  }
  return `${entry.source}#${entry.ref}`;
}

function isVendoredSkillEntry(value: unknown): value is IVendoredSkillEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const source = getObjectValue(value, "source");
  const ref = getObjectValue(value, "ref");
  return typeof source === "string" && (ref === undefined || typeof ref === "string");
}

function isVendoredSkillRecord(value: unknown): value is Record<string, IVendoredSkillEntry> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.values(value).every((entry) => isVendoredSkillEntry(entry));
}

async function readVendoredSkillLock(lockPath: string): Promise<IVendoredSkillLock> {
  const parsed: unknown = JSON.parse(await readFile(lockPath, "utf-8"));
  const skills = typeof parsed === "object" && parsed !== null ? getObjectValue(parsed, "skills") : undefined;
  if (typeof parsed !== "object" || parsed === null || !isVendoredSkillRecord(skills)) {
    throw new Error(`Invalid vendored skill lock: ${lockPath}`);
  }

  const version = getObjectValue(parsed, "version");
  return { version: typeof version === "number" ? version : 1, skills };
}

function createDefaultDependencies(): IVendoredSkillCommandDependencies {
  return { argv: process.argv, root: getRegistryPaths().root, relocate: relocateVendoredSkill };
}

export async function updateVendoredSkillsCommand(
  dependencies: IVendoredSkillCommandDependencies = createDefaultDependencies(),
): Promise<void> {
  const { root } = dependencies;
  const lockPath = join(root, "skills-lock.json");
  const requestedSkillNames = getRequestedSkillNames(dependencies.argv);
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
    await runCommand({
      cmd: ["npx", "skills", "add", installSource, "--skill", skillName, "-a", "openclaw", "--copy", "-y"],
      cwd: root,
      description: `update skill ${skillName}`,
      spawn: dependencies.spawn,
    });
    await dependencies.relocate(root, skillName, entry.source);
  }
}
