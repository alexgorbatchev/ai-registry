#!/usr/bin/env bash
set -euo pipefail

# Default target folder in the user's current working directory
TARGET_DIR="${TARGET_DIR:-.claude/skills}"

# GitHub repository archive URL
REPO_URL="${SKILLS_REPO_URL:-https://github.com/alexgorbatchev/ai-registry/archive/refs/heads/main.tar.gz}"

# Parent .claude directory
CLAUDE_DIR="$(dirname "$TARGET_DIR")"

# Ensure target directories exist
mkdir -p "$CLAUDE_DIR"
mkdir -p "$TARGET_DIR"

# Create a temporary directory for downloading and extraction
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Downloading skills and system prompt from GitHub..."
curl -fsSL "$REPO_URL" | tar -xz -C "$TMP_DIR"

# Find the extracted system prompt file
SYSTEM_SRC="$(find "$TMP_DIR" -maxdepth 3 -type f -path "*/system/system.md" | head -n 1)"

if [ -n "$SYSTEM_SRC" ] && [ -f "$SYSTEM_SRC" ]; then
  echo "Installing system prompt into $CLAUDE_DIR..."
  cp "$SYSTEM_SRC" "$CLAUDE_DIR/CLAUDE.md"
  cp "$SYSTEM_SRC" "$CLAUDE_DIR/system.md"
  echo "  - $CLAUDE_DIR/CLAUDE.md"
  echo "  - $CLAUDE_DIR/system.md"
else
  echo "Warning: Could not locate system/system.md in downloaded archive." >&2
fi

# Find the extracted skills directory inside the archive root
SKILLS_SRC="$(find "$TMP_DIR" -maxdepth 2 -type d -name "skills" | head -n 1)"

if [ -z "$SKILLS_SRC" ] || [ ! -d "$SKILLS_SRC" ]; then
  echo "Error: Could not locate skills directory in the downloaded archive." >&2
  exit 1
fi

echo "Installing skills into $TARGET_DIR..."
COUNT=0
for skill in "$SKILLS_SRC"/*; do
  if [ -d "$skill" ]; then
    skill_name="$(basename "$skill")"
    rm -rf "$TARGET_DIR/$skill_name"
    cp -R "$skill" "$TARGET_DIR/$skill_name"
    echo "  - $skill_name"
    COUNT=$((COUNT + 1))
  fi
done

echo ""
echo "Successfully installed system prompt and $COUNT skills into $(pwd)/$CLAUDE_DIR"
