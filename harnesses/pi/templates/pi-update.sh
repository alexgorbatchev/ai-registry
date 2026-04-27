#!/bin/bash
# pi-update helper
# Updates the registry and pi packages
# Usage: pi-update
export PI_CODING_AGENT_DIR="{{repo_root}}/harnesses/pi"

SETTINGS_FILE="${PI_CODING_AGENT_DIR}/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
  echo "Refreshing registry packages..."
  pi update "$@"
fi

cd "{{repo_root}}" && bun run build
