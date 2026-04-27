import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ISkillUsageCountEntry } from "./createSkillUsageReport";

export interface ISkillSyncPickerOption {
  disabled: boolean;
  hint?: string;
  label: string;
  value: string;
}

interface ISkillSyncManifest {
  version: number;
  generatedAt: string;
  registryRootPath: string;
  projectRootPath: string;
  selectedSkills: string[];
  files: Record<string, string>;
}

interface ISkillSyncDrift {
  path: string;
  reason: "missing" | "modified" | "unexpected";
}

export interface ISyncProjectSkillsArgs {
  availableSkillDirByName: ReadonlyMap<string, string>;
  autoConfirm: boolean;
  confirmOverwrite?: (message: string) => Promise<boolean>;
  isInteractive: boolean;
  pickSkills?: (args: {
    initialValues: readonly string[];
    options: readonly ISkillSyncPickerOption[];
  }) => Promise<readonly string[]>;
  projectRootPath: string;
  promptForSelection: boolean;
  registryRootPath: string;
  usedSkills: readonly ISkillUsageCountEntry[];
}

export interface ISyncProjectSkillsResult {
  manifestPath: string;
  selectedSkills: string[];
  skillsDirPath: string;
  warningMessages: string[];
}

const SKILL_SYNC_MANIFEST_VERSION = 1;

function getObjectValue(object: object, key: string): unknown {
  return Reflect.get(object, key);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === "string");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isSkillSyncManifest(value: unknown): value is ISkillSyncManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const version = getObjectValue(value, "version");
  const generatedAt = getObjectValue(value, "generatedAt");
  const registryRootPath = getObjectValue(value, "registryRootPath");
  const projectRootPath = getObjectValue(value, "projectRootPath");
  const selectedSkills = getObjectValue(value, "selectedSkills");
  const files = getObjectValue(value, "files");

  return (
    version === SKILL_SYNC_MANIFEST_VERSION &&
    typeof generatedAt === "string" &&
    typeof registryRootPath === "string" &&
    typeof projectRootPath === "string" &&
    isStringArray(selectedSkills) &&
    isStringRecord(files)
  );
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function createFileChecksum(fileBuffer: Buffer): string {
  return createHash("sha256").update(fileBuffer).digest("hex");
}

export function getProjectSkillSyncPaths(projectRootPath: string): {
  manifestPath: string;
  opencodeDirPath: string;
  skillsDirPath: string;
} {
  const opencodeDirPath = join(projectRootPath, ".opencode");
  return {
    manifestPath: join(opencodeDirPath, "skills-manifest.json"),
    opencodeDirPath,
    skillsDirPath: join(opencodeDirPath, "skills"),
  };
}

async function readSkillSyncManifest(manifestPath: string): Promise<ISkillSyncManifest | undefined> {
  if (!existsSync(manifestPath)) {
    return undefined;
  }

  const manifestContent = await readFile(manifestPath, "utf8");
  const parsedManifest = JSON.parse(manifestContent);
  if (!isSkillSyncManifest(parsedManifest)) {
    throw new Error(`Invalid skill sync manifest: ${manifestPath}`);
  }

  return parsedManifest;
}

async function collectDirectoryChecksums(
  opencodeDirPath: string,
  currentDirPath: string,
): Promise<Record<string, string>> {
  if (!existsSync(currentDirPath)) {
    return {};
  }

  const checksums: Record<string, string> = {};
  const entries = await readdir(currentDirPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(currentDirPath, entry.name);
    if (entry.isDirectory()) {
      Object.assign(checksums, await collectDirectoryChecksums(opencodeDirPath, entryPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileBuffer = await readFile(entryPath);
    const relativePath = normalizeRelativePath(entryPath.slice(opencodeDirPath.length + 1));
    checksums[relativePath] = createFileChecksum(fileBuffer);
  }

  return checksums;
}

async function collectSkillChecksums(
  opencodeDirPath: string,
  skillsDirPath: string,
  skillNames: readonly string[],
): Promise<Record<string, string>> {
  const checksums: Record<string, string> = {};
  for (const skillName of skillNames) {
    Object.assign(checksums, await collectDirectoryChecksums(opencodeDirPath, join(skillsDirPath, skillName)));
  }

  return checksums;
}

function getSkillSyncDrift(
  manifest: ISkillSyncManifest,
  currentChecksums: Record<string, string>,
): ISkillSyncDrift[] {
  const drift: ISkillSyncDrift[] = [];

  for (const [relativePath, expectedChecksum] of Object.entries(manifest.files)) {
    const actualChecksum = currentChecksums[relativePath];
    if (!actualChecksum) {
      drift.push({ path: relativePath, reason: "missing" });
      continue;
    }

    if (actualChecksum !== expectedChecksum) {
      drift.push({ path: relativePath, reason: "modified" });
    }
  }

  for (const relativePath of Object.keys(currentChecksums)) {
    if (!(relativePath in manifest.files)) {
      drift.push({ path: relativePath, reason: "unexpected" });
    }
  }

  return drift.sort((left, right) => left.path.localeCompare(right.path));
}

function formatSkillSyncDrift(drift: readonly ISkillSyncDrift[]): string {
  return drift.map((entry) => `  - ${entry.path} (${entry.reason})`).join("\n");
}

async function confirmOverwriteIfNeeded(args: {
  autoConfirm: boolean;
  confirmOverwrite?: (message: string) => Promise<boolean>;
  drift: readonly ISkillSyncDrift[];
  isInteractive: boolean;
}): Promise<void> {
  if (args.drift.length === 0) {
    return;
  }

  if (args.autoConfirm) {
    return;
  }

  if (!args.isInteractive || !args.confirmOverwrite) {
    throw new Error(
      "Skill sync cancelled. Managed .opencode skill files were modified and no interactive confirmation is available. Re-run with --yes to overwrite them.",
    );
  }

  const shouldOverwrite = await args.confirmOverwrite(
    `Managed project-local skill files changed:\n${formatSkillSyncDrift(args.drift)}\n\nOverwrite them with the synced copies?`,
  );
  if (!shouldOverwrite) {
    throw new Error("Skill sync cancelled.");
  }
}

async function confirmInitialOverwriteIfNeeded(args: {
  autoConfirm: boolean;
  confirmOverwrite?: (message: string) => Promise<boolean>;
  existingFiles: readonly string[];
  isInteractive: boolean;
}): Promise<void> {
  if (args.existingFiles.length === 0) {
    return;
  }

  if (args.autoConfirm) {
    return;
  }

  if (!args.isInteractive || !args.confirmOverwrite) {
    throw new Error(
      "Skill sync cancelled. Destination skill directories already contain files and no interactive confirmation is available. Re-run with --yes to overwrite them.",
    );
  }

  const shouldOverwrite = await args.confirmOverwrite(
    `The target .opencode skill directories already contain files:\n${args.existingFiles.map((filePath) => `  - ${filePath}`).join("\n")}\n\nOverwrite them with the synced copies?`,
  );
  if (!shouldOverwrite) {
    throw new Error("Skill sync cancelled.");
  }
}

function createPickerOptions(
  usedSkills: readonly ISkillUsageCountEntry[],
  availableSkillDirByName: ReadonlyMap<string, string>,
): ISkillSyncPickerOption[] {
  return usedSkills.map((skill) => ({
    disabled: !availableSkillDirByName.has(skill.name),
    hint: availableSkillDirByName.has(skill.name)
      ? `${skill.count} uses, ${skill.averagePerDay.toFixed(2)}/day`
      : "not found in registry",
    label: skill.name,
    value: skill.name,
  }));
}

function getInitialSelection(args: {
  existingManifest: ISkillSyncManifest | undefined;
  availableSkillDirByName: ReadonlyMap<string, string>;
  usedSkills: readonly ISkillUsageCountEntry[];
}): string[] {
  if (args.existingManifest) {
    return args.existingManifest.selectedSkills.filter((skillName) => args.availableSkillDirByName.has(skillName));
  }

  return args.usedSkills
    .map((skill) => skill.name)
    .filter((skillName) => args.availableSkillDirByName.has(skillName));
}

function getNewUnsyncedUsedSkills(args: {
  existingManifest: ISkillSyncManifest;
  usedSkills: readonly ISkillUsageCountEntry[];
  availableSkillDirByName: ReadonlyMap<string, string>;
}): string[] {
  const selectedSkillNames = new Set(args.existingManifest.selectedSkills);
  return args.usedSkills
    .map((skill) => skill.name)
    .filter((skillName) => args.availableSkillDirByName.has(skillName) && !selectedSkillNames.has(skillName));
}

function getUnavailableUsedSkillNames(
  usedSkills: readonly ISkillUsageCountEntry[],
  availableSkillDirByName: ReadonlyMap<string, string>,
): string[] {
  return usedSkills.map((skill) => skill.name).filter((skillName) => !availableSkillDirByName.has(skillName));
}

function createManifest(args: {
  files: Record<string, string>;
  projectRootPath: string;
  registryRootPath: string;
  selectedSkills: string[];
}): ISkillSyncManifest {
  return {
    version: SKILL_SYNC_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    registryRootPath: args.registryRootPath,
    projectRootPath: args.projectRootPath,
    selectedSkills: args.selectedSkills,
    files: args.files,
  };
}

export async function syncProjectSkills(args: ISyncProjectSkillsArgs): Promise<ISyncProjectSkillsResult> {
  const { manifestPath, opencodeDirPath, skillsDirPath } = getProjectSkillSyncPaths(args.projectRootPath);
  const existingManifest = await readSkillSyncManifest(manifestPath);
  const shouldPromptForSelection = args.promptForSelection || !existingManifest;
  const warningMessages: string[] = [];
  const unavailableUsedSkillNames = getUnavailableUsedSkillNames(args.usedSkills, args.availableSkillDirByName);

  if (unavailableUsedSkillNames.length > 0) {
    warningMessages.push(`Used skills not found in the registry and skipped: ${unavailableUsedSkillNames.join(", ")}.`);
  }

  let selectedSkills = existingManifest?.selectedSkills ?? [];

  if (shouldPromptForSelection) {
    if (args.usedSkills.length === 0) {
      throw new Error("No used skills found in the current project scope to sync.");
    }
    if (!args.isInteractive || !args.pickSkills) {
      throw new Error("Skill selection requires an interactive terminal. Re-run in a TTY or save a manifest first.");
    }

    selectedSkills = [...(await args.pickSkills({
      initialValues: getInitialSelection({
        existingManifest,
        availableSkillDirByName: args.availableSkillDirByName,
        usedSkills: args.usedSkills,
      }),
      options: createPickerOptions(args.usedSkills, args.availableSkillDirByName),
    }))];
  } else if (existingManifest) {
    const newUnsyncedUsedSkills = getNewUnsyncedUsedSkills({
      existingManifest,
      usedSkills: args.usedSkills,
      availableSkillDirByName: args.availableSkillDirByName,
    });
    if (newUnsyncedUsedSkills.length > 0) {
      warningMessages.push(
        `New used skills are available but not included in the saved manifest: ${newUnsyncedUsedSkills.join(", ")}. Re-run with --pick to update the selection.`,
      );
    }
  }

  const missingSelectedSkills = selectedSkills.filter((skillName) => !args.availableSkillDirByName.has(skillName));
  if (missingSelectedSkills.length > 0) {
    throw new Error(`Cannot sync missing skills from the registry: ${missingSelectedSkills.join(", ")}`);
  }

  await mkdir(opencodeDirPath, { recursive: true });
  await mkdir(skillsDirPath, { recursive: true });

  if (existingManifest) {
    const currentChecksums = await collectSkillChecksums(opencodeDirPath, skillsDirPath, existingManifest.selectedSkills);
    await confirmOverwriteIfNeeded({
      autoConfirm: args.autoConfirm,
      confirmOverwrite: args.confirmOverwrite,
      drift: getSkillSyncDrift(existingManifest, currentChecksums),
      isInteractive: args.isInteractive,
    });
  } else {
    const existingFiles = Object.keys(await collectSkillChecksums(opencodeDirPath, skillsDirPath, selectedSkills)).sort();
    await confirmInitialOverwriteIfNeeded({
      autoConfirm: args.autoConfirm,
      confirmOverwrite: args.confirmOverwrite,
      existingFiles,
      isInteractive: args.isInteractive,
    });
  }

  const previouslySelectedSkills = existingManifest?.selectedSkills ?? [];
  const selectedSkillNames = new Set(selectedSkills);
  const skillsToRemove = previouslySelectedSkills.filter((skillName) => !selectedSkillNames.has(skillName));
  for (const skillName of skillsToRemove) {
    await rm(join(skillsDirPath, skillName), { recursive: true, force: true });
  }

  for (const skillName of selectedSkills) {
    const sourceDirPath = args.availableSkillDirByName.get(skillName);
    if (!sourceDirPath) {
      throw new Error(`Cannot sync missing skill ${skillName}`);
    }

    const destinationDirPath = join(skillsDirPath, skillName);
    await rm(destinationDirPath, { recursive: true, force: true });
    await cp(sourceDirPath, destinationDirPath, { force: true, recursive: true });
  }

  const files = await collectSkillChecksums(opencodeDirPath, skillsDirPath, selectedSkills);
  const manifest = createManifest({
    files,
    projectRootPath: args.projectRootPath,
    registryRootPath: args.registryRootPath,
    selectedSkills,
  });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    manifestPath,
    selectedSkills,
    skillsDirPath,
    warningMessages,
  };
}
