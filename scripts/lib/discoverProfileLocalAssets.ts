import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";

export type IProfileLocalAssets = {
  profileLocalCommands: string[];
  profileLocalSkills: string[];
};

function compareNames(left: string, right: string): number {
  return left.localeCompare(right);
}

async function discoverProfileLocalCommands(profileDir: string): Promise<string[]> {
  const commandsDir = join(profileDir, "commands");
  if (!existsSync(commandsDir)) {
    return [];
  }

  const entries = await readdir(commandsDir, { withFileTypes: true });
  const commandNames: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      throw new Error(
        `Profile-local commands must be top-level Markdown files only: ${join(commandsDir, entry.name)}`,
      );
    }

    if (!entry.name.endsWith(".md")) {
      throw new Error(
        `Profile-local commands must use .md filenames: ${join(commandsDir, entry.name)}`,
      );
    }

    commandNames.push(entry.name);
  }

  return commandNames.sort(compareNames);
}

async function discoverProfileLocalSkills(profileDir: string): Promise<string[]> {
  const skillsDir = join(profileDir, "skills");
  if (!existsSync(skillsDir)) {
    return [];
  }

  const entries = await readdir(skillsDir, { withFileTypes: true });
  const skillNames: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      throw new Error(
        `Profile-local skills must be top-level directories only: ${join(skillsDir, entry.name)}`,
      );
    }

    const skillDefinitionPath = join(skillsDir, entry.name, "SKILL.md");
    if (!existsSync(skillDefinitionPath)) {
      throw new Error(
        `Profile-local skills must include SKILL.md: ${skillDefinitionPath}`,
      );
    }

    skillNames.push(entry.name);
  }

  return skillNames.sort(compareNames);
}

export async function discoverProfileLocalAssets(profileDir: string): Promise<IProfileLocalAssets> {
  const [profileLocalCommands, profileLocalSkills] = await Promise.all([
    discoverProfileLocalCommands(profileDir),
    discoverProfileLocalSkills(profileDir),
  ]);

  return {
    profileLocalCommands,
    profileLocalSkills,
  };
}
