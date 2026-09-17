import { mkdir, readdir, symlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parseArgs } from "node:util";

import { renderTemplate } from "@alexgorbatchev/template-resolver";

import type {
  IProfileBuildContext,
  IUnifiedHarnessBuildContext,
  IUnifiedHarnessPlugin,
} from "../../lib/harnessBuild";
import { createExternalProfileHelper } from "../../lib/createExternalProfileHelper";
import { getProfileLocalCommandOutputName } from "../../lib/profileLocalAssetNames";
import {
  assertMissingClaudeCodeOutputPath,
  assertSupportedClaudeCodeManifest,
} from "./lib/profileOutputRules";

const CLAUDE_CODE_OUTPUT_DIR_NAME = "claude-code";
const MEMORY_FILE_NAME = "CLAUDE.md";
const SKILLS_DIR_NAME = "skills";
const DEFAULT_PROFILE_NAME = "default";

// Claude Code reads CLAUDE.md, not AGENTS.md. The vendored claude-agents-md preload
// (see vendor/claude-agents-md/README.md for the pinned fork) patches node:fs inside
// the claude process so CLAUDE.md lookups are served from a sibling AGENTS.md. It is linked into the default profile root under the
// same name upstream installs it as (~/.claude/agents-md-vfs.js), so every generated
// profile exposes it at $CLAUDE_CONFIG_DIR/agents-md-vfs.js for BUN_OPTIONS.
const AGENTS_MD_VFS_FILE_NAME = "agents-md-vfs.js";
const AGENTS_MD_VFS_VENDOR_PATH = join("vendor", "claude-agents-md", AGENTS_MD_VFS_FILE_NAME);

// Directories Claude Code writes runtime state into. They are materialized as static
// directories in the default profile root so every generated profile shares one
// history, plugin install, and session store instead of diverging per profile.
const SHARED_RUNTIME_DIR_NAMES = [
  "file-history",
  "plugins",
  "projects",
  "session-env",
  "sessions",
  "shell-snapshots",
  "statsig",
  "todos",
];

function getProfileOutputDir(outputDir: string, profileName: string): string {
  return join(outputDir, CLAUDE_CODE_OUTPUT_DIR_NAME, profileName);
}

async function renderSystemPrompt(context: IProfileBuildContext): Promise<string> {
  const systemPrompt = typeof context.manifest.system_prompt === "string"
    ? context.manifest.system_prompt
    : "";

  if (systemPrompt.trim().length === 0) {
    return "";
  }

  return renderTemplate({
    content: systemPrompt,
    sourcePath: join(context.profileDir, "profile.yaml"),
    repositoryRoot: context.templateContext.repo_root,
    variables: context.templateContext,
    environment: process.env,
  });
}

async function stageProfileMemoryFile(context: IProfileBuildContext, profileOutputDir: string): Promise<void> {
  const renderedSystemPrompt = await renderSystemPrompt(context);
  if (renderedSystemPrompt.trim().length === 0) {
    return;
  }

  await writeFile(join(profileOutputDir, MEMORY_FILE_NAME), `${renderedSystemPrompt.trim()}\n`, "utf-8");
}

async function stageHarnessFiles(context: IProfileBuildContext, profileOutputDir: string): Promise<void> {
  if (!existsSync(context.harnessDir)) {
    return;
  }

  await context.buildSupport.copyDirectoryWithTemplateVariables(
    context.harnessDir,
    profileOutputDir,
    context.templateContext,
  );
}

async function stageSharedRuntimeDirectories(profileOutputDir: string): Promise<void> {
  for (const runtimeDirName of SHARED_RUNTIME_DIR_NAMES) {
    await mkdir(join(profileOutputDir, runtimeDirName), { recursive: true });
  }
}

async function stageAgentsMdVfs(context: IProfileBuildContext, profileOutputDir: string): Promise<void> {
  const vendoredVfsPath = join(context.templateContext.repo_root, AGENTS_MD_VFS_VENDOR_PATH);
  if (!existsSync(vendoredVfsPath)) {
    throw new Error(`Vendored AGENTS.md VFS does not exist: ${vendoredVfsPath}`);
  }

  await symlink(vendoredVfsPath, join(profileOutputDir, AGENTS_MD_VFS_FILE_NAME));
}

async function stageHarnessLocalSkills(context: IProfileBuildContext, skillsDir: string): Promise<void> {
  const harnessSkillsDir = join(context.harnessDir, SKILLS_DIR_NAME);
  if (!existsSync(harnessSkillsDir)) {
    return;
  }

  const harnessSkillEntries = await readdir(harnessSkillsDir, { withFileTypes: true });
  for (const harnessSkillEntry of harnessSkillEntries) {
    if (!harnessSkillEntry.isDirectory()) {
      throw new Error(
        `Claude Code harness skills must be directories: ${join(harnessSkillsDir, harnessSkillEntry.name)}`,
      );
    }

    const outputPath = join(skillsDir, harnessSkillEntry.name);
    assertMissingClaudeCodeOutputPath(
      outputPath,
      `Claude Code harness skill ${harnessSkillEntry.name}`,
    );

    await context.buildSupport.symlinkDirectoryWithOriginalFiles(
      join(harnessSkillsDir, harnessSkillEntry.name),
      outputPath,
    );
  }
}

async function stageProfileSkills(context: IProfileBuildContext, skillsDir: string): Promise<void> {
  for (const matchedSkill of context.globalMatchedSkills) {
    const outputPath = join(skillsDir, matchedSkill);
    if (existsSync(outputPath)) {
      continue;
    }

    await context.buildSupport.symlinkDirectoryWithOriginalFiles(
      join(context.templateContext.skills_dir, matchedSkill),
      outputPath,
    );
  }

  for (const profileLocalSkill of context.profileLocalSkills) {
    const outputPath = join(skillsDir, profileLocalSkill);
    assertMissingClaudeCodeOutputPath(
      outputPath,
      `profile-local skill ${profileLocalSkill} for profile ${context.profileName}`,
    );

    await context.buildSupport.symlinkDirectoryWithOriginalFiles(
      join(context.profileDir, SKILLS_DIR_NAME, profileLocalSkill),
      outputPath,
    );
  }
}

async function stageProfile(context: IProfileBuildContext): Promise<void> {
  assertSupportedClaudeCodeManifest(context.manifest, context.profileName);

  const profileOutputDir = getProfileOutputDir(context.outputDir, context.profileName);
  const skillsDir = join(profileOutputDir, SKILLS_DIR_NAME);
  const isDefaultProfile = context.profileName === DEFAULT_PROFILE_NAME;

  await mkdir(skillsDir, { recursive: true });
  await stageProfileMemoryFile(context, profileOutputDir);

  if (isDefaultProfile) {
    await stageHarnessFiles(context, profileOutputDir);
    await stageSharedRuntimeDirectories(profileOutputDir);
    await stageAgentsMdVfs(context, profileOutputDir);
    await mkdir(join(profileOutputDir, "commands"), { recursive: true });

    await context.buildSupport.stageProfileAssets(context, {
      commandsDir: join(profileOutputDir, "commands"),
      skillsDir,
      localCommandRenamer: getProfileLocalCommandOutputName,
    });
  } else {
    await stageProfileSkills(context, skillsDir);
  }

  await stageHarnessLocalSkills(context, skillsDir);
}

async function finalizeOutput(context: IUnifiedHarnessBuildContext): Promise<void> {
  const claudeCodeOutputDir = join(context.outputDir, CLAUDE_CODE_OUTPUT_DIR_NAME);
  const finalClaudeCodeOutputDir = join(context.templateContext.output_dir, CLAUDE_CODE_OUTPUT_DIR_NAME);
  if (!existsSync(claudeCodeOutputDir)) {
    return;
  }

  const defaultProfileOutputDir = getProfileOutputDir(context.outputDir, DEFAULT_PROFILE_NAME);
  if (!existsSync(defaultProfileOutputDir)) {
    throw new Error(`Generated Claude Code default profile does not exist: ${defaultProfileOutputDir}`);
  }

  const profileEntries = await readdir(claudeCodeOutputDir, { withFileTypes: true });
  const defaultProfileEntries = await readdir(defaultProfileOutputDir, { withFileTypes: true });

  for (const profileEntry of profileEntries) {
    if (!profileEntry.isDirectory() || profileEntry.name === DEFAULT_PROFILE_NAME) {
      continue;
    }

    const profileOutputDir = join(claudeCodeOutputDir, profileEntry.name);
    for (const defaultProfileEntry of defaultProfileEntries) {
      if (defaultProfileEntry.name === SKILLS_DIR_NAME || defaultProfileEntry.name === MEMORY_FILE_NAME) {
        continue;
      }

      const targetPath = join(profileOutputDir, defaultProfileEntry.name);
      if (existsSync(targetPath)) {
        continue;
      }

      await symlink(
        join(finalClaudeCodeOutputDir, DEFAULT_PROFILE_NAME, defaultProfileEntry.name),
        targetPath,
      );
    }

    // The default profile is reached through the `~/.claude` symlink that bootstrap
    // creates, so only non-default profiles need a launcher that overrides
    // CLAUDE_CONFIG_DIR. Nothing generated here shadows the real `claude` binary.
    // The launcher also preloads the AGENTS.md VFS from the profile root it selects,
    // matching the `claude()` shell function that covers the bare `claude` command.
    const profileConfigDir = `{{output_dir}}/${CLAUDE_CODE_OUTPUT_DIR_NAME}/${profileEntry.name}`;
    await context.buildSupport.writeBinScript(
      context.outputDir,
      `claude-${profileEntry.name}`,
      createExternalProfileHelper("claude", "CLAUDE_CONFIG_DIR", profileConfigDir, {
        bunPreloadScriptPath: `${profileConfigDir}/${AGENTS_MD_VFS_FILE_NAME}`,
      }),
    );
  }
}

function getRequestedClaudeCodeProfile(argv: string[]): string | null {
  const { values } = parseArgs({
    args: argv.slice(2),
    options: {
      "claude-code-profile": { type: "string" },
    },
    strict: false,
  });

  const value = values["claude-code-profile"];
  if (value === true || (typeof value === "string" && value.trim().length === 0)) {
    throw new Error("Missing Claude Code profile name after --claude-code-profile.");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return null;
}

async function getGeneratedClaudeCodeProfileNames(outputDir: string): Promise<string[]> {
  const claudeCodeOutputDir = join(outputDir, CLAUDE_CODE_OUTPUT_DIR_NAME);
  if (!existsSync(claudeCodeOutputDir)) {
    return [];
  }

  const profileEntries = await readdir(claudeCodeOutputDir, { withFileTypes: true });
  return profileEntries
    .filter((profileEntry) => profileEntry.isDirectory())
    .map((profileEntry) => profileEntry.name)
    .sort();
}

function formatMissingClaudeCodeProfileMessage(sourcePath: string, availableProfiles: string[]): string {
  if (availableProfiles.length === 0) {
    return `Generated Claude Code profile does not exist: ${sourcePath}. No generated Claude Code profiles are available.`;
  }
  return `Generated Claude Code profile does not exist: ${sourcePath}. Available generated Claude Code profiles: ${availableProfiles.join(", ")}.`;
}

async function getBootstrapTargets(outputDir: string): Promise<Array<{ sourcePath: string; targetPath: string; description: string }>> {
  const profile = getRequestedClaudeCodeProfile(process.argv) ?? DEFAULT_PROFILE_NAME;

  const sourcePath = getProfileOutputDir(outputDir, profile);
  if (!existsSync(sourcePath)) {
    const availableProfiles = await getGeneratedClaudeCodeProfileNames(outputDir);
    throw new Error(formatMissingClaudeCodeProfileMessage(sourcePath, availableProfiles));
  }

  return [
    {
      sourcePath,
      targetPath: process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), ".claude"),
      description: `Claude Code config (${profile})`,
    },
  ];
}

const plugin: IUnifiedHarnessPlugin = {
  target: CLAUDE_CODE_OUTPUT_DIR_NAME,
  stageProfile,
  finalizeOutput,
  getBootstrapTargets,
};

export default plugin;
