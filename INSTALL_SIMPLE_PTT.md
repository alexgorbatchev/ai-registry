# Installing `simple-ptt` Latest Release

This repository provides a lightweight installer script that downloads and extracts the latest compiled release of [`alexgorbatchev/simple-ptt`](https://github.com/alexgorbatchev/simple-ptt) directly into `.tmp/simple-ptt` without requiring `git clone` or repository bootstrap.

## Quick Start

Run the following command in your terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/alexgorbatchev/ai-registry/main/install-simple-ptt.sh | bash
```

The script will:
1. Fetch release metadata for the latest release of `alexgorbatchev/simple-ptt` from GitHub.
2. Download the release binary package (`.dmg`, `.zip`, `.tar.gz`).
3. Extract the release contents directly into `.tmp/simple-ptt`.

## Customization Options

### Custom Target Directory

By default, the release is extracted into `.tmp/simple-ptt` relative to your current working directory. You can override the target directory using the `TARGET_DIR` environment variable:

```bash
curl -fsSL https://raw.githubusercontent.com/alexgorbatchev/ai-registry/main/install-simple-ptt.sh | TARGET_DIR="custom/path/to/app" bash
```

## Requirements

- `curl`
- `tar` / `unzip` / `hdiutil` (macOS native)
- `bash`
