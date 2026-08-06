# Installing Skills into `.claude/skills`

This repository provides a lightweight installer script that downloads and installs all AI skills directly into your project's `.claude/skills/` directory without requiring `bun`, `git clone`, or repository bootstrap.

## Quick Start

Run the following command in the root of your project:

```bash
curl -fsSL https://raw.githubusercontent.com/alexgorbatchev/ai-registry/main/install-claude-skills.sh | bash
```

The script will:
1. Create the `.claude/skills/` directory if it does not already exist.
2. Download the latest skill set directly from GitHub.
3. Extract and place each skill directory inside `.claude/skills/`.

## Customization Options

### Custom Target Directory

By default, skills are installed into `.claude/skills` relative to your current working directory. You can override the target directory by setting the `TARGET_DIR` environment variable:

```bash
curl -fsSL https://raw.githubusercontent.com/alexgorbatchev/ai-registry/main/install-claude-skills.sh | TARGET_DIR="custom/path/to/skills" bash
```

### Custom Repository Branch or URL

To fetch skills from a specific branch, tag, or fork, pass the `SKILLS_REPO_URL` environment variable:

```bash
curl -fsSL https://raw.githubusercontent.com/alexgorbatchev/ai-registry/main/install-claude-skills.sh | SKILLS_REPO_URL="https://github.com/alexgorbatchev/ai-registry/archive/refs/heads/main.tar.gz" bash
```

## Requirements

- `curl`
- `tar`
- `bash`

No Node.js, Bun, or build steps are required.
