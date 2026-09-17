#!/bin/bash
set -e

# Change to the directory of this script
cd "$(dirname "$0")"

REPO_URL="https://github.com/anthropics/claude-code.git"
TARGET_DIR=".tmp/claude-code-source"

if [ ! -d "$TARGET_DIR" ]; then
  echo "Cloning claude-code source (depth 1)..."
  mkdir -p .tmp
  git clone --depth 1 "$REPO_URL" "$TARGET_DIR"
else
  echo "Updating claude-code source..."
  cd "$TARGET_DIR"
  git pull --depth 1
fi
