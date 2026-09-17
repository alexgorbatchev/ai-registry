export type IExternalProfileHelperOptions = {
  // Absolute path (template tokens allowed) to a script Bun must preload into the
  // launched binary through BUN_OPTIONS="--require ...". Only meaningful for
  // binaries compiled with Bun, such as Claude Code.
  bunPreloadScriptPath?: string;
};

function renderBunPreloadBlock(bunPreloadScriptPath: string): string {
  // Call-time merge: keep whatever BUN_OPTIONS the caller already exported and
  // append the preload only when it is missing, so the launcher composes with
  // other BUN_OPTIONS setters instead of clobbering them and never double-appends.
  return `bun_preload_script="${bunPreloadScriptPath}"
case " \${BUN_OPTIONS:-} " in
  *" --require $bun_preload_script "*) ;;
  *) BUN_OPTIONS="\${BUN_OPTIONS:+$BUN_OPTIONS }--require $bun_preload_script" ;;
esac
export BUN_OPTIONS

`;
}

export function createExternalProfileHelper(
  binaryName: string,
  environmentVariableName: string,
  profilePath: string,
  options: IExternalProfileHelperOptions = {},
): string {
  const bunPreloadBlock = options.bunPreloadScriptPath === undefined
    ? ""
    : renderBunPreloadBlock(options.bunPreloadScriptPath);

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
if command -v ${binaryName} >/dev/null 2>&1; then
  real_binary="${binaryName}"
else
  # Fallback to looking for backed-up shims in script_dir and generated_bin_dir
  latest_backup=""
  for backup_dir in "\$script_dir" "\$generated_bin_dir"; do
    for backup_file in "\$backup_dir"/${binaryName}.backup-*; do
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
  printf 'Could not find the real ${binaryName} binary outside ai-registry wrapper paths.\\n' >&2
  exit 1
fi

${bunPreloadBlock}${environmentVariableName}="${profilePath}" exec "\$real_binary" "\$@"
`;
}
