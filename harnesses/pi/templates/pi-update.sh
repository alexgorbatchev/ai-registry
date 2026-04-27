#!/bin/bash
# pi-update helper
# Updates the registry and pi packages
# Usage: pi-update
SETTINGS_FILE="{{repo_root}}/harnesses/pi/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
  echo "Refreshing registry packages..."
  pi update
fi
cd "{{repo_root}}" && bun run build
