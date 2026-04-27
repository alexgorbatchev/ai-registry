#!/bin/bash
# pi-uninstall helper
# Uninstalls plugins from the registry settings.json
# Usage: pi-uninstall <plugin-package-name> [args...]
if [ -z "$1" ]; then
  echo "Usage: pi-uninstall <plugin-package-name> [args...]"
  exit 1
fi

export PI_CODING_AGENT_DIR="{{repo_root}}/harnesses/pi"

pi uninstall "$@"

# Run build to update generated outputs
cd "{{repo_root}}" && bun run build
