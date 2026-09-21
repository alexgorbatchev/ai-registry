import { lstat, mkdir, readdir, rename, symlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { parseArgs } from "node:util";

import { renderTemplate } from "@alexgorbatchev/template-resolver";

import type {
  IProfileBuildContext,
  IUnifiedHarnessBuildContext,
  IUnifiedHarnessPlugin,
} from "../../lib/harnessBuild";
import { createExternalProfileHelper } from "../../lib/createExternalProfileHelper";
import { getErrorMessage } from "../../lib/getErrorMessage";
import { getProfileLocalCommandOutputName } from "../../lib/profileLocalAssetNames";
import {
  assertMissingClaudeCodeOutputPath,
  assertSupportedClaudeCodeManifest,
} from "./lib/profileOutputRules";

const CLAUDE_CODE_OUTPUT_DIR_NAME = "claude-code";
const MEMORY_FILE_NAME = "CLAUDE.md";
const SKILLS_DIR_NAME = "skills";
const DEFAULT_PROFILE_NAME = "default";

// Directories Claude Code writes runtime state into. They are materialized in the
// default profile root so every generated profile shares one history, plugin
// install, and session store instead of diverging per profile. Claude Code creates,
// fills, and prunes them afterwards, so they are registered as runtime directories:
// recreated when missing but never tracked by the manifest or reported as drift.
const SHARED_RUNTIME_DIR_NAMES = [
  "file-history",
  "session-env",
  "statsig",
];

// Work a rebuild must not destroy: per-project memory files and transcripts
// (`projects/`), the session history `claude --resume` reads (`sessions/`), the
// per-session todo lists (`todos/`), the shell snapshots those sessions restore from
// (`shell-snapshots/`), and the installed plugins a user would otherwise have to add
// back by hand (`plugins/`). `.output/` is generated and may be deleted at any time,
// so these stores live in the user's XDG data directory and are symlinked into the
// generated default profile root. Non-default profiles reach them through the symlink
// chain finalizeOutput() already builds from the default profile.
const PERSISTENT_STORE_DIR_NAMES = ["plugins", "projects", "sessions", "shell-snapshots", "todos"];
const PERSISTENT_STORE_ROOT_SEGMENTS = ["ai-registry", "claude-code"];

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

async function stageSharedRuntimeDirectories(context: IProfileBuildContext, profileOutputDir: string): Promise<void> {
  for (const runtimeDirName of SHARED_RUNTIME_DIR_NAMES) {
    await context.buildSupport.ensureRuntimeDirectory(join(profileOutputDir, runtimeDirName));
  }
}

function getPersistentStoreRoot(): string {
  const dataHome = process.env.XDG_DATA_HOME?.trim() || join(homedir(), ".local", "share");
  return join(dataHome, ...PERSISTENT_STORE_ROOT_SEGMENTS);
}

// Builds that predate a persistent store left a real directory in the generated
// output. Move it once, so existing history survives the switch instead of being
// shadowed by an empty store.
async function migrateLegacyStore(storeDirName: string, legacyStorePath: string, storePath: string): Promise<void> {
  const legacyStoreStats = await lstat(legacyStorePath).catch(() => null);
  if (legacyStoreStats === null || legacyStoreStats.isSymbolicLink() || !legacyStoreStats.isDirectory()) {
    return;
  }

  if (existsSync(storePath)) {
    throw new Error(
      `Cannot move the Claude Code ${storeDirName} store: ${legacyStorePath} and ${storePath} both exist. Merge them by hand, then rerun the build.`,
    );
  }

  await mkdir(dirname(storePath), { recursive: true });

  try {
    await rename(legacyStorePath, storePath);
  } catch (error) {
    throw new Error(
      `Failed to move the Claude Code ${storeDirName} store from ${legacyStorePath} to ${storePath}: ${getErrorMessage(error)}. Move it by hand, then rerun the build.`,
    );
  }

  console.log(`   📦 Moved the Claude Code ${storeDirName} store to ${storePath}`);
}

async function stagePersistentStores(context: IProfileBuildContext, profileOutputDir: string): Promise<void> {
  const storeRoot = getPersistentStoreRoot();
  const finalDefaultProfileDir = join(
    context.templateContext.output_dir,
    CLAUDE_CODE_OUTPUT_DIR_NAME,
    DEFAULT_PROFILE_NAME,
  );

  for (const storeDirName of PERSISTENT_STORE_DIR_NAMES) {
    const storePath = join(storeRoot, storeDirName);

    await migrateLegacyStore(storeDirName, join(finalDefaultProfileDir, storeDirName), storePath);
    await mkdir(storePath, { recursive: true });
    await symlink(storePath, join(profileOutputDir, storeDirName));
  }
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

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(harnessSkillsDir, harnessSkillEntry.name),
      outputPath,
      context.templateContext,
    );
  }
}

async function stageProfileSkills(context: IProfileBuildContext, skillsDir: string): Promise<void> {
  for (const matchedSkill of context.globalMatchedSkills) {
    const outputPath = join(skillsDir, matchedSkill);
    if (existsSync(outputPath)) {
      continue;
    }

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(context.templateContext.skills_dir, matchedSkill),
      outputPath,
      context.templateContext,
    );
  }

  for (const profileLocalSkill of context.profileLocalSkills) {
    const outputPath = join(skillsDir, profileLocalSkill);
    assertMissingClaudeCodeOutputPath(
      outputPath,
      `profile-local skill ${profileLocalSkill} for profile ${context.profileName}`,
    );

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(context.profileDir, SKILLS_DIR_NAME, profileLocalSkill),
      outputPath,
      context.templateContext,
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
    await stageSharedRuntimeDirectories(context, profileOutputDir);
    await stagePersistentStores(context, profileOutputDir);
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

function createLiteLLMHelper(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
generated_bin_dir="{{output_dir}}/bin"
filtered_path=""

IFS=':' read -r -a path_entries <<< "\${PATH:-}"
for path_entry in "\${path_entries[@]}"; do
  normalized_path="\${path_entry:-.}"
  if [ "\$normalized_path" = "\$script_dir" ] || [ "\$normalized_path" = "\$generated_bin_dir" ]; then
    continue
  fi

  if [ -n "\$filtered_path" ]; then
    filtered_path="\${filtered_path}:\$normalized_path"
  else
    filtered_path="\$normalized_path"
  fi
done

PATH="\$filtered_path"
export PATH

real_binary=""
if command -v claude >/dev/null 2>&1; then
  real_binary="claude"
else
  latest_backup=""
  for backup_dir in "\$script_dir" "\$generated_bin_dir"; do
    for backup_file in "\$backup_dir"/claude.backup-*; do
      if [ -x "\$backup_file" ]; then
        if [ -z "\$latest_backup" ] || [ "\$backup_file" -nt "\$latest_backup" ]; then
          latest_backup="\$backup_file"
        fi
      fi
    done
  done

  if [ -n "\$latest_backup" ]; then
    real_binary="\$latest_backup"
  fi
fi

if [ -z "\$real_binary" ]; then
  printf 'Could not find the real claude binary outside ai-registry wrapper paths.\\n' >&2
  exit 1
fi

MODEL="\${CLAUDE_MODEL:-gemini-3.7-flash}"
if [ $# -gt 0 ] && [[ "$1" != -* ]]; then
  MODEL="$1"
  shift
fi

for i in "$@"; do
  if [ "\${prev_arg:-}" = "--model" ]; then
    MODEL="$i"
  fi
  prev_arg="$i"
done

BASE_URL="\${ANTHROPIC_BASE_URL:-\${LITELLM_BASE_URL:-}}"
AUTH_TOKEN="\${ANTHROPIC_AUTH_TOKEN:-\${LITELLM_API_KEY:-\${ANTHROPIC_API_KEY:-}}}"

if [ -z "$BASE_URL" ]; then
  printf 'Error: Neither ANTHROPIC_BASE_URL nor LITELLM_BASE_URL is set in environment.\\n' >&2
  exit 1
fi

if [ -z "$AUTH_TOKEN" ]; then
  printf 'Error: Neither ANTHROPIC_AUTH_TOKEN, LITELLM_API_KEY, nor ANTHROPIC_API_KEY is set in environment.\\n' >&2
  exit 1
fi

export ANTHROPIC_BASE_URL="$BASE_URL"
export ANTHROPIC_AUTH_TOKEN="$AUTH_TOKEN"
export ANTHROPIC_API_KEY="$AUTH_TOKEN"
export ANTHROPIC_CUSTOM_MODEL_OPTION="$MODEL"
export ANTHROPIC_MODEL="$MODEL"
export CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT=1
export CLAUDE_CODE_MAX_CONTEXT_TOKENS="\${CLAUDE_CODE_MAX_CONTEXT_TOKENS:-1000000}"

exec "\$real_binary" --dangerously-skip-permissions --model "$MODEL" "\$@"
`;
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
    const profileConfigDir = `{{output_dir}}/${CLAUDE_CODE_OUTPUT_DIR_NAME}/${profileEntry.name}`;
    await context.buildSupport.writeBinScript(
      context.outputDir,
      `claude-${profileEntry.name}`,
      createExternalProfileHelper("claude", "CLAUDE_CONFIG_DIR", profileConfigDir),
    );
  }

  await context.buildSupport.writeBinScript(
    context.outputDir,
    "cll",
    createLiteLLMHelper(),
  );
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
