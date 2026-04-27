#!/bin/bash
# pi-install helper
# Installs plugins into the registry settings.json
# Usage: pi-install <plugin-package-name>
if [ -z "$1" ]; then
  echo "Usage: pi-install <plugin-package-name>"
  exit 1
fi

SETTINGS_FILE="{{repo_root}}/harnesses/pi/settings.json"
PLUGIN="$1"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "jq is required for pi-install"
    exit 1
fi

# Add to packages array if not already present
jq --arg pkg "$PLUGIN" '.packages += [$pkg] | .packages |= unique' "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp" && mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"

echo "Installed $PLUGIN into $SETTINGS_FILE"
# Run build to update generated outputs
cd "{{repo_root}}" && bun run build
