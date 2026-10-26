import { mkdir, readFile, readdir, rm, symlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parseArgs } from "node:util";

import { renderTemplate } from "@alexgorbatchev/template-resolver";

import type {
  IBootstrapTarget,
  IProfileBuildContext,
  IUnifiedHarnessBuildContext,
  IUnifiedHarnessPlugin,
} from "../../lib/harnessBuild";
import { createExternalProfileHelper } from "../../lib/createExternalProfileHelper";
import { getProfileLocalCommandOutputName } from "../../lib/profileLocalAssetNames";
import { logHarnessSkillOverrides } from "../../lib/logHarnessSkillOverrides";
import { getProfileHomeDir, getProfileHomeShellPath } from "../../lib/profileHomeUtils";
import {
  getOutputSkillName,
  injectDisableModelInvocation,
  parseSkillAuthor,
  readHarnessSkillEntries,
  updateSkillName,
} from "../../lib/userSkillUtils";
import {
  assertMissingClaudeCodeOutputPath,
  assertSupportedClaudeCodeManifest,
} from "./lib/profileOutputRules";

const CLAUDE_CODE_OUTPUT_DIR_NAME = "claude-code";
const MEMORY_FILE_NAME = "CLAUDE.md";
const SETTINGS_FILE_NAME = "settings.json";
const SKILLS_DIR_NAME = "skills";
const DEFAULT_PROFILE_NAME = "default";

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

  // Claude Code writes `/config`, `/model`, and installer changes back to this file.
  const settingsPath = join(profileOutputDir, SETTINGS_FILE_NAME);
  if (existsSync(settingsPath)) {
    context.buildSupport.syncSettingsFile(settingsPath);
  }
}

async function stageHarnessLocalSkills(context: IProfileBuildContext, skillsDir: string): Promise<void> {
  const harnessSkillsDir = join(context.harnessDir, SKILLS_DIR_NAME);
  if (!existsSync(harnessSkillsDir)) {
    return;
  }

  const harnessSkillEntries = await readHarnessSkillEntries(harnessSkillsDir);
  for (const harnessSkillEntry of harnessSkillEntries) {
    const skillFilePath = join(harnessSkillEntry.sourcePath, "SKILL.md");
    let skillAuthor: string | null = null;
    if (existsSync(skillFilePath)) {
      const content = await readFile(skillFilePath, "utf-8");
      skillAuthor = parseSkillAuthor(content);
    }
    const outputSkillName = getOutputSkillName(harnessSkillEntry.name, skillAuthor);
    const outputPath = join(skillsDir, outputSkillName);
    if (existsSync(outputPath)) {
      await rm(outputPath, { recursive: true, force: true });
    }

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      harnessSkillEntry.sourcePath,
      outputPath,
      context.templateContext,
    );

    const generatedSkillFilePath = join(outputPath, "SKILL.md");
    if (existsSync(generatedSkillFilePath)) {
      let content = await readFile(generatedSkillFilePath, "utf-8");
      if (outputSkillName !== harnessSkillEntry.name) {
        content = updateSkillName(content, outputSkillName);
      }
      if (harnessSkillEntry.isUser) {
        content = injectDisableModelInvocation(content);
      }
      await writeFile(generatedSkillFilePath, content, "utf-8");
    }
  }
}

async function stageProfileSkills(context: IProfileBuildContext, skillsDir: string): Promise<void> {
  await context.buildSupport.stageProfileAssets(context, { skillsDir });
}

async function stageProfile(context: IProfileBuildContext): Promise<void> {
  assertSupportedClaudeCodeManifest(context.manifest, context.profileName);

  const profileOutputDir = getProfileOutputDir(context.outputDir, context.profileName);
  const skillsDir = join(profileOutputDir, SKILLS_DIR_NAME);
  const isDefaultProfile = context.profileName === DEFAULT_PROFILE_NAME;

  await mkdir(skillsDir, { recursive: true });
  await stageProfileMemoryFile(context, profileOutputDir);

  await stageHarnessLocalSkills(context, skillsDir);

  if (isDefaultProfile) {
    await stageHarnessFiles(context, profileOutputDir);
    await mkdir(join(profileOutputDir, "commands"), { recursive: true });

    await context.buildSupport.stageProfileAssets(context, {
      commandsDir: join(profileOutputDir, "commands"),
      skillsDir,
      localCommandRenamer: getProfileLocalCommandOutputName,
    });
  } else {
    await stageProfileSkills(context, skillsDir);
  }
}

function createLiteLLMHelper(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
generated_bin_dir="<%- output_dir %>/bin"
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

    // The default profile is applied to `~/.claude` by bootstrap, so only non-default
    // profiles need a launcher that overrides CLAUDE_CONFIG_DIR with their own home.
    // Nothing generated here shadows the real `claude` binary.
    await context.buildSupport.writeBinScript(
      context.outputDir,
      `claude-${profileEntry.name}`,
      createExternalProfileHelper(
        "claude",
        "CLAUDE_CONFIG_DIR",
        getProfileHomeShellPath(CLAUDE_CODE_OUTPUT_DIR_NAME, profileEntry.name),
      ),
    );
  }

  await context.buildSupport.writeBinScript(
    context.outputDir,
    "cll",
    createLiteLLMHelper(),
  );

  await logHarnessSkillOverrides(context, "claude-code");
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

async function getBootstrapTargets(outputDir: string): Promise<IBootstrapTarget[]> {
  const profile = getRequestedClaudeCodeProfile(process.argv) ?? DEFAULT_PROFILE_NAME;
  const availableProfiles = await getGeneratedClaudeCodeProfileNames(outputDir);

  const sourcePath = getProfileOutputDir(outputDir, profile);
  if (!existsSync(sourcePath)) {
    throw new Error(formatMissingClaudeCodeProfileMessage(sourcePath, availableProfiles));
  }

  const homePath = process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), ".claude");
  return [
    { kind: "home", sourcePath, targetPath: homePath, description: `Claude Code config (${profile})` },
    ...availableProfiles
      .filter((profileName) => profileName !== DEFAULT_PROFILE_NAME)
      .map((profileName): IBootstrapTarget => ({
        kind: "home",
        sourcePath: getProfileOutputDir(outputDir, profileName),
        targetPath: getProfileHomeDir(CLAUDE_CODE_OUTPUT_DIR_NAME, profileName, process.env),
        description: `Claude Code profile home (${profileName})`,
        sharedHomePath: homePath,
      })),
  ];
}

const plugin: IUnifiedHarnessPlugin = {
  target: CLAUDE_CODE_OUTPUT_DIR_NAME,
  stageProfile,
  finalizeOutput,
  getBootstrapTargets,
};

export default plugin;
