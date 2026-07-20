#!/bin/bash
set -e

# Change to the directory of this script
cd "$(dirname "$0")"

REPO_URL="https://github.com/earendil-works/pi.git"
TARGET_DIR=".tmp/pi-source"

if [ ! -d "$TARGET_DIR" ]; then
  echo "Cloning pi source (depth 1)..."
  mkdir -p .tmp
  git clone --depth 1 "$REPO_URL" "$TARGET_DIR"
else
  echo "Updating pi source..."
  cd "$TARGET_DIR"
  git pull --depth 1
fi
