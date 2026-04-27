#!/bin/bash
# pi-install helper
# Installs plugins into the registry settings.json
# Usage: pi-install <plugin-package-name>
if [ -z "$1" ]; then
  echo "Usage: pi-install <plugin-package-name> [args...]"
  exit 1
fi

pi install "$@"

SETTINGS_FILE="{{repo_root}}/harnesses/pi/settings.json"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "jq is required to update registry settings, skipping settings.json update"
    exit 0
fi

for arg in "$@"; do
  # Skip flags
  if [[ "$arg" == -* ]]; then
    continue
  fi
  
  # Add to packages array if not already present
  jq --arg pkg "$arg" '.packages += [$pkg] | .packages |= unique' "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp" && mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
  echo "Added $arg to $SETTINGS_FILE"
done

# Run build to update generated outputs
cd "{{repo_root}}" && bun run build
