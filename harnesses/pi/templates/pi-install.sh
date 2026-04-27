#!/bin/bash
# pi-install helper
# Installs plugins into the registry settings.json
# Usage: pi-install <plugin-package-name>
if [ -z "$1" ]; then
  echo "Usage: pi-install <plugin-package-name> [args...]"
  exit 1
fi

export PI_CODING_AGENT_DIR="{{repo_root}}/harnesses/pi"

pi install "$@"

# Run build to update generated outputs
cd "{{repo_root}}" && bun run build
