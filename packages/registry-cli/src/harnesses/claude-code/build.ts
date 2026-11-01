import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { stageAssets, stageHarnessFiles, type IHarnessBuildContext, type IUnifiedHarnessPlugin } from "../../lib/harnessBuild";

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


async function build(context: IHarnessBuildContext): Promise<void> {
  const targetDir = join(context.outputDir, "claude-code");
  await stageHarnessFiles(context, targetDir);
  await stageAssets(context, { skillsDir: join(targetDir, "skills"), commandsDir: join(targetDir, "commands") });
  const settingsPath = join(targetDir, "settings.json");
  if (existsSync(settingsPath)) context.buildSupport.syncSettingsFile(settingsPath);
  await context.buildSupport.writeBinScript(context.outputDir, "cll", createLiteLLMHelper());
}

const plugin: IUnifiedHarnessPlugin = {
  target: "claude-code", build,
  async getBootstrapTargets(outputDir) {
    return [{ kind: "home", sourcePath: join(outputDir, "claude-code"),
      targetPath: process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), ".claude"), description: "Claude Code config" }];
  },
};
export default plugin;
