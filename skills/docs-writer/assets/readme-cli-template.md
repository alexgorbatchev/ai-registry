# CLI README Template

Use this template for CLI repositories. The rules it embodies are in `../references/readme.md` (shared) and `../references/readme-cli.md` (CLI-specific). Replace every placeholder with verified project evidence; never ship placeholder text.

---

```markdown
A fast, lightweight CLI tool to process and synchronize local datasets with remote storage backends.

# What It Does

- Synchronizes local directories with remote object storage without locking the filesystem.
- Validates data integrity before uploading using checksum verification.
- Generates structured audit reports for batch operations.

# How It Works

- Scans the specified local directory to discover modified files.
- Compares each file against the remote storage metadata to identify differences.
- Uploads only new or changed files and notifies you when completed.

# How it Really Works

- Files are matched by their contents rather than their timestamps, so renaming or re-saving a file never causes a second upload.
- Only the parts of a file that differ from the remote copy are sent, and an interrupted run resumes from the last committed chunk instead of starting over.
- Each run writes its audit report to `$XDG_DATA_HOME/mytool/reports/<timestamp>.json` and leaves earlier reports in place, so nothing is overwritten between runs.
- The report path is printed to stdout and all progress goes to stderr, so redirecting stdout captures the path alone.

# Prerequisites

- [Access Token](https://example.com/tokens) - Required for authenticated remote storage. Set `MYTOOL_TOKEN` or pass `--token`.

# Installation

Download the prebuilt binary for your platform from the [latest release](https://github.com/username/mytool/releases/latest), replacing `X.X.X` with the version shown on that page.

```bash
# macOS (Apple Silicon)
curl -sSL https://github.com/username/mytool/releases/latest/download/mytool_X.X.X_darwin_arm64.tar.gz | tar -xz -C ~/.local/bin
```

# Quick Start

```bash
# Sync current directory
mytool sync ./data

# Force overwrite with verbose logging
mytool sync ./data --force --verbose
```

Sample Output:
```
scanning ./data ... 128 files
uploading 12 changed files ... done
report: ~/.local/share/mytool/reports/2026-09-18T10-43-00.json
```

# Options & Flags

| Flag | Short | Default | Description |
| :--- | :--- | :--- | :--- |
| `--config <path>` | `-c` | `~/.config/mytool.json` | Path to custom configuration file |
| `--force` | `-f` | `false` | Overwrite existing files without prompting |
| `--verbose` | `-v` | `false` | Enable detailed output logging |
| `--version` | `-V` | `false` | Print version information and exit |
| `--help` | `-h` | `false` | Print command line help |

# License

MIT License (c) 2026 Alex Gorbatchev
```
