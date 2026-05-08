export function createExternalProfileHelper(
  binaryName: string,
  environmentVariableName: string,
  profilePath: string,
): string {
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

if ! command -v ${binaryName} >/dev/null 2>&1; then
  printf 'Could not find the real ${binaryName} binary outside ai-registry wrapper paths.\\n' >&2
  exit 1
fi

${environmentVariableName}="${profilePath}" exec ${binaryName} "$@"
`;
}
