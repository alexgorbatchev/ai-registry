import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import type { IBootstrapTarget, IHarnessBuildContext, IUnifiedHarnessPlugin } from "../../lib/harnessBuild";
import { logHarnessSkillOverrides } from "../../lib/logHarnessSkillOverrides";

const CLAUDE_CODE_OUTPUT_DIR_NAME = "claude-code";
const MEMORY_FILE_NAME = "CLAUDE.md";
// Files Claude Code edits at runtime: `/config`, `/model`, and installers write
// `settings.json`; `/keybindings` and installers write `keybindings.json`.
const SYNCED_SETTINGS_FILE_NAMES = ["settings.json", "keybindings.json"];
const SKILLS_DIR_NAME = "skills";
// Claude Code reads user-scope MCP servers only from its global config file, which
// also holds its runtime state. The build renders the registry's `claude.json` with
// overlays merged into the generated output; bootstrap writes its `mcpServers` entries
// into the global config file, so the build itself changes nothing outside the registry.
const MCP_SERVERS_FILE_NAME = "claude.json";
const GLOBAL_CONFIG_FILE_NAME = ".claude.json";
// MCP server fields that can hold credentials Claude Code stores.
const MCP_SERVER_LIVE_ONLY_KEYS = ["headers", "env"];

async function stageHarnessFiles(context: IHarnessBuildContext, claudeCodeOutputDir: string): Promise<void> {
  if (!existsSync(context.harnessDir)) {
    return;
  }

  await context.buildSupport.stageSourceDirectory(context.harnessDir, claudeCodeOutputDir);

  for (const fileName of SYNCED_SETTINGS_FILE_NAMES) {
    const settingsPath = join(claudeCodeOutputDir, fileName);
    if (existsSync(settingsPath)) {
      context.buildSupport.syncSettingsFile(settingsPath);
    }
  }
}

// `CLAUDE_CONFIG_DIR` moves the global config file into that directory.
function getGlobalConfigPath(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR?.trim();
  return join(configDir || homedir(), GLOBAL_CONFIG_FILE_NAME);
}

async function stageMcpServers(context: IHarnessBuildContext, claudeCodeOutputDir: string): Promise<void> {
  const sourcePath = join(context.harnessDir, MCP_SERVERS_FILE_NAME);
  if (!existsSync(sourcePath)) {
    return;
  }

  const stagedPath = join(claudeCodeOutputDir, MCP_SERVERS_FILE_NAME);
  await context.buildSupport.stageSourcePath(sourcePath, stagedPath);
  context.buildSupport.syncSettingsFile(stagedPath, { shouldLinkIntoHome: false });
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
  if [ "$normalized_path" = "$script_dir" ] || [ "$normalized_path" = "$generated_bin_dir" ]; then
    continue
  fi

  if [ -n "$filtered_path" ]; then
    filtered_path="\${filtered_path}:$normalized_path"
  else
    filtered_path="$normalized_path"
  fi
done

PATH="$filtered_path"
export PATH

real_binary=""
if command -v claude >/dev/null 2>&1; then
  real_binary="claude"
else
  latest_backup=""
  for backup_dir in "$script_dir" "$generated_bin_dir"; do
    for backup_file in "$backup_dir"/claude.backup-*; do
      if [ -x "$backup_file" ]; then
        if [ -z "$latest_backup" ] || [ "$backup_file" -nt "$latest_backup" ]; then
          latest_backup="$backup_file"
        fi
      fi
    done
  done

  if [ -n "$latest_backup" ]; then
    real_binary="$latest_backup"
  fi
fi

if [ -z "$real_binary" ]; then
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

exec "$real_binary" --dangerously-skip-permissions --model "$MODEL" "$@"
`;
}

async function buildOutput(context: IHarnessBuildContext): Promise<void> {
  const claudeCodeOutputDir = join(context.outputDir, CLAUDE_CODE_OUTPUT_DIR_NAME);
  const skillsDir = join(claudeCodeOutputDir, SKILLS_DIR_NAME);
  const commandsDir = join(claudeCodeOutputDir, "commands");

  await mkdir(skillsDir, { recursive: true });
  await context.buildSupport.stageSourcePath(context.systemPromptPath, join(claudeCodeOutputDir, MEMORY_FILE_NAME));

  await context.buildSupport.stageHarnessSkills(context, skillsDir);
  await stageHarnessFiles(context, claudeCodeOutputDir);
  await stageMcpServers(context, claudeCodeOutputDir);
  await mkdir(commandsDir, { recursive: true });
  await context.buildSupport.stageRegistryAssets(context, { commandsDir, skillsDir });

  await context.buildSupport.writeBinScript(context.outputDir, "cll", createLiteLLMHelper());

  await logHarnessSkillOverrides(context, "claude-code");
}

async function getBootstrapTargets(outputDir: string): Promise<IBootstrapTarget[]> {
  return [
    {
      kind: "home",
      sourcePath: join(outputDir, CLAUDE_CODE_OUTPUT_DIR_NAME),
      targetPath: process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), ".claude"),
      description: "Claude Code config",
    },
    {
      kind: "entries",
      sourcePath: join(outputDir, CLAUDE_CODE_OUTPUT_DIR_NAME, MCP_SERVERS_FILE_NAME),
      targetPath: getGlobalConfigPath(),
      description: "Claude Code MCP servers",
      tables: [["mcpServers"]],
      liveOnlyEntryKeys: MCP_SERVER_LIVE_ONLY_KEYS,
    },
  ];
}

const plugin: IUnifiedHarnessPlugin = {
  target: CLAUDE_CODE_OUTPUT_DIR_NAME,
  buildOutput,
  getBootstrapTargets,
};

export default plugin;
