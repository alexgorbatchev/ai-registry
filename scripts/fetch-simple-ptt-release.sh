#!/usr/bin/env bash
set -euo pipefail

REPO="alexgorbatchev/simple-ptt"
TARGET_DIR="${1:-.tmp/simple-ptt}"
ENCRYPTED_KEY="U2FsdGVkX1/qoIJL2tXKb+yXnWUGnu3WEyOkJnGw56aM4MvbKJ//me97G75XdByknw0CUq46lWdHvAVNnCUWrg=="

# Prompt for decryption password
if [ -t 0 ]; then
  read -rs -p "Enter decryption password for DEEPGRAM_API_KEY: " PASSWORD
  echo ""
elif [ -e /dev/tty ] && [ -t 1 ]; then
  read -rs -p "Enter decryption password for DEEPGRAM_API_KEY: " PASSWORD < /dev/tty
  echo ""
else
  read -r PASSWORD
fi

# Decrypt key in memory
DECRYPTED_KEY="$(echo "$ENCRYPTED_KEY" | openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -a -d -pass pass:"$PASSWORD" 2>/dev/null || true)"
unset PASSWORD

if [ -z "$DECRYPTED_KEY" ]; then
  echo "Error: Decryption failed. Incorrect password." >&2
  exit 1
fi

echo "Key successfully decrypted in memory."

# Ensure parent directory of target exists
mkdir -p "$(dirname "$TARGET_DIR")"

echo "Fetching latest release information for $REPO..."
RELEASE_JSON="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")"
TAG_NAME="$(echo "$RELEASE_JSON" | grep '"tag_name":' | head -n 1 | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"

if [ -z "$TAG_NAME" ]; then
  echo "Error: Could not determine latest release tag for $REPO" >&2
  exit 1
fi

echo "Latest release: $TAG_NAME"

# Find asset URL (preferring .dmg, .zip, .tar.gz, .tgz)
ASSET_URL="$(echo "$RELEASE_JSON" | grep '"browser_download_url":' | grep -E '\.(dmg|zip|tar\.gz|tgz)"' | head -n 1 | sed -E 's/.*"browser_download_url": *"([^"]+)".*/\1/')"

if [ -z "$ASSET_URL" ]; then
  echo "Error: Could not find suitable release asset (.dmg, .zip, .tar.gz, .tgz) for $REPO" >&2
  exit 1
fi

ASSET_NAME="$(basename "$ASSET_URL")"
TMP_DOWNLOAD="$(mktemp -d)"
trap 'rm -rf "$TMP_DOWNLOAD"' EXIT

DOWNLOAD_PATH="$TMP_DOWNLOAD/$ASSET_NAME"

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

# Create start.sh launcher script inside target directory with DEEPGRAM_API_KEY set
START_SCRIPT="$TARGET_DIR/start.sh"
cat <<EOF > "$START_SCRIPT"
#!/usr/bin/env bash
DIR="\$(cd "\$(dirname "\$0")" && pwd)"
export DEEPGRAM_API_KEY="$DECRYPTED_KEY"
if [ -d "\$DIR/simple-ptt.app" ]; then
  exec "\$DIR/simple-ptt.app/Contents/MacOS/simple-ptt" "\$@"
elif [ -f "\$DIR/simple-ptt" ]; then
  exec "\$DIR/simple-ptt" "\$@"
else
  echo "Error: simple-ptt executable not found in \$DIR" >&2
  exit 1
fi
EOF
chmod +x "$START_SCRIPT"

# Clear decrypted key from memory
unset DECRYPTED_KEY

echo ""
echo "Successfully extracted $REPO $TAG_NAME release into $(pwd)/$TARGET_DIR"
echo "Created launcher script: $START_SCRIPT"
echo ""
echo "To start simple-ptt with DEEPGRAM_API_KEY set:"
echo "  $START_SCRIPT"
