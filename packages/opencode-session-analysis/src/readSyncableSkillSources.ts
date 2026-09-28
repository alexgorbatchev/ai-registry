import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export interface ISyncableSkillSource {
  name: string;
  owner: string;
  sourceDirPath: string;
  sourceKind: "registry" | "harness" | "profile-local";
}

async function readSkillDirectories(
  rootPath: string,
  sourceKind: ISyncableSkillSource["sourceKind"],
  owner: string,
): Promise<ISyncableSkillSource[]> {
  if (!existsSync(rootPath)) {
    return [];
  }

  const agentPath = join(rootPath, "agent");
  const userPath = join(rootPath, "user");
  const dirsToScan: string[] = [];

  if (existsSync(agentPath)) dirsToScan.push(agentPath);
  if (existsSync(userPath)) dirsToScan.push(userPath);

  const results: ISyncableSkillSource[] = [];

  for (const dir of dirsToScan) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && existsSync(join(dir, entry.name, "SKILL.md"))) {
        results.push({
          name: entry.name,
          owner,
          sourceDirPath: join(dir, entry.name),
          sourceKind,
        });
      }
    }
  }

  const rootEntries = await readdir(rootPath, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.name === "agent" || entry.name === "user" || !entry.isDirectory()) continue;
    if (existsSync(join(rootPath, entry.name, "SKILL.md"))) {
      results.push({
        name: entry.name,
        owner,
        sourceDirPath: join(rootPath, entry.name),
        sourceKind,
      });
    }
  }

  return results.sort((left, right) => left.name.localeCompare(right.name));
}

async function readProfileLocalSkillDirectories(registryRootPath: string): Promise<ISyncableSkillSource[]> {
  const profilesDirPath = join(registryRootPath, "profiles");
  if (!existsSync(profilesDirPath)) {
    return [];
  }

  const profileEntries = await readdir(profilesDirPath, { withFileTypes: true });
  const sources: ISyncableSkillSource[] = [];

  for (const profileEntry of profileEntries) {
    if (!profileEntry.isDirectory()) {
      continue;
    }

    sources.push(
      ...(await readSkillDirectories(
        join(profilesDirPath, profileEntry.name, "skills"),
        "profile-local",
        profileEntry.name,
      )),
    );
  }

  return sources.sort((left, right) => left.name.localeCompare(right.name) || left.owner.localeCompare(right.owner));
}

export async function readSyncableSkillSources(registryRootPath: string): Promise<Map<string, ISyncableSkillSource>> {
  const sources = [
    ...(await readSkillDirectories(join(registryRootPath, "skills"), "registry", "skills")),
    ...(await readSkillDirectories(join(registryRootPath, "harnesses", "opencode", "skills"), "harness", "harnesses/opencode")),
    ...(await readProfileLocalSkillDirectories(registryRootPath)),
  ];

  const sourceByName = new Map<string, ISyncableSkillSource>();
  for (const source of sources) {
    const existingSource = sourceByName.get(source.name);
    if (existingSource) {
      throw new Error(`Duplicate syncable skill name ${source.name} found in ${source.owner} and ${existingSource.owner}`);
    }

    sourceByName.set(source.name, source);
  }

  return sourceByName;
}
