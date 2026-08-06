#!/usr/bin/env bash
set -euo pipefail

REPO="alexgorbatchev/simple-ptt"
TARGET_DIR="${1:-.tmp/simple-ptt}"

mkdir -p .tmp

# Fetch latest release metadata from GitHub API
echo "Fetching latest release information for $REPO..."
RELEASE_JSON="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")"
TAG_NAME="$(echo "$RELEASE_JSON" | jq -r '.tag_name')"

echo "Latest release: $TAG_NAME"

# Find asset URL (preferring .dmg, .zip, .tar.gz, .tgz)
ASSET_URL="$(echo "$RELEASE_JSON" | jq -r '.assets[] | select(.name | test("\\.(dmg|zip|tar\\.gz|tgz)$")) | .browser_download_url' | head -n 1)"

if [ -z "$ASSET_URL" ] || [ "$ASSET_URL" = "null" ]; then
  echo "Error: Could not find suitable release asset (.dmg, .zip, .tar.gz, .tgz) for $REPO" >&2
  exit 1
fi

ASSET_NAME="$(basename "$ASSET_URL")"
DOWNLOAD_PATH=".tmp/$ASSET_NAME"

echo "Downloading $ASSET_NAME..."
curl -fsSL -o "$DOWNLOAD_PATH" "$ASSET_URL"

# Recreate target directory
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

echo "Extracting $ASSET_NAME into $TARGET_DIR..."

case "$ASSET_NAME" in
  *.dmg)
    if command -v hdiutil >/dev/null 2>&1; then
      MOUNT_DIR="$(mktemp -d)"
      hdiutil attach "$DOWNLOAD_PATH" -mountpoint "$MOUNT_DIR" -nobrowse -quiet
      for item in "$MOUNT_DIR"/*; do
        if [ -e "$item" ] && [ "$(basename "$item")" != "Applications" ]; then
          cp -R "$item" "$TARGET_DIR/"
        fi
      done
      hdiutil detach "$MOUNT_DIR" -quiet
      rm -rf "$MOUNT_DIR"
    else
      echo "Error: hdiutil is required to extract .dmg files on macOS." >&2
      exit 1
    fi
    ;;
  *.zip)
    unzip -q "$DOWNLOAD_PATH" -d "$TARGET_DIR"
    ;;
  *.tar.gz|*.tgz)
    tar -xzf "$DOWNLOAD_PATH" -C "$TARGET_DIR"
    ;;
  *)
    echo "Unsupported archive format: $ASSET_NAME" >&2
    exit 1
    ;;
esac

rm -f "$DOWNLOAD_PATH"

echo "Successfully extracted $REPO $TAG_NAME release into $(pwd)/$TARGET_DIR"
ls -la "$TARGET_DIR"
