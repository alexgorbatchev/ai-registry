---
description: Perform a remote GitHub repository security audit (malware, supply-chain abuse, suspicious binaries, social-engineering docs)
targets: ['*']
---

Perform a **security-first code audit** of the target GitHub repository. Focus on:

1. malware and malicious payloads,
2. supply-chain abuse,
3. suspicious install instructions,
4. hidden execution paths,
5. credential theft or exfiltration risk.

## Scope and constraints

- Treat this as a **security incident investigation**, not a style review.
- Use the repository URL provided by the user.
- If branch is unspecified, start with `main`; if missing, retry `master`.
- **Never execute untrusted binaries/scripts.** Static analysis only.

## Required workflow

### 1) Acquire repository safely

Use `gitsnip` to fetch the full repo into a deterministic temp path under:

- `.tmp/gitsnip/<owner-repo>/<branch>/full`

Use `.` as folder path and an explicit output directory.

If sparse mode misses files or behaves oddly, re-fetch with API mode (`-m api`).

### 2) Map and inventory

- Run `repoguide` on the downloaded repo for a quick structure map (if parseable).
- Enumerate all files and highlight:
  - archives (`.zip`, `.7z`, `.rar`, `.tar*`),
  - executables / binaries (`.exe`, `.dll`, `.so`, `.dylib`, ELF/PE/Mach-O),
  - scripts with misleading extensions,
  - CI/workflow files,
  - install/bootstrap scripts,
  - package/manifest files.

### 3) Hunt suspicious patterns

Search for indicators including (adapt by language):

- command execution: `os.execute`, `system`, `spawn`, `exec`, `jobstart`, `popen`, `Runtime.getRuntime().exec`, `subprocess`, `ProcessBuilder`
- network/download: `curl`, `wget`, `Invoke-WebRequest`, `bitsadmin`, raw GitHub URLs, paste sites, webhook URLs
- stealth/persistence: startup folders, scheduled tasks, registry autoruns, launch agents, cron edits
- obfuscation/evasion: long encoded blobs, `base64` decode + exec, dynamic eval/loadstring/reflective loading
- secret theft/exfil: token/env harvesting, browser credential paths, keychain/credential APIs

### 4) Deep inspect suspicious artifacts

For each suspicious file:

- record path, size, type (`file` output),
- compute SHA-256,
- inspect strings/metadata statically,
- if archive, list/extract contents **without executing**,
- identify mismatches (e.g., `.ico` that is script/text, README link that is a binary payload).

### 5) Audit social-engineering vectors

Inspect `README*`, docs, install snippets, and release notes for:

- instructions that point to raw binary payloads,
- plugin/package declarations that are actually download URLs,
- replaced official install paths with suspicious artifacts,
- misleading claims inconsistent with source code.

### 6) Audit history and provenance

- Inspect git history to find **when** suspicious files/instructions were introduced.
- Show commit(s), author(s), and file-level diffs.
- If this appears to be a fork, compare with likely upstream/canonical repo when possible.

### 7) Risk judgment

Assign severity per finding:

- **critical**: likely malware/trojan/dropper, credential theft, active exploitation path
- **high**: strong malicious indicators or dangerous supply-chain behavior
- **medium**: suspicious but inconclusive; needs sandbox/reverse engineering
- **low**: hygiene issues with weak direct exploitability

Prioritize concrete, evidence-based findings over speculation.

## Output format (mandatory)

Return the audit using this exact structure:

```md
Summary
- Overall risk: <critical|high|medium|low>
- Verdict: <safe to use | do not use | use with constraints>
- Scope reviewed: <branch, commit/window, notable files>

Findings
1. Severity: <critical|high|medium|low>
   - Location: <file/commit>
   - Evidence: <exact behavior, hash, strings, diff signals>
   - Why this matters: <impact>
   - Recommendation: <what to do now>

2. ...

Indicators of Compromise (IOCs)
- File hashes (SHA-256):
  - <hash>  <path>
- Suspicious URLs/domains:
  - <url>
- Suspicious commands/patterns:
  - <pattern>

Test gaps / uncertainty
- <what could not be verified statically>

Immediate actions
- <containment/remediation steps>
```

## GitHub abuse report output (required when risk is high/critical)

If the audit identifies **high** or **critical** malicious indicators, also generate a ready-to-submit GitHub "Report abuse" message.

- Include: repository URL, concise incident summary, concrete evidence, suspicious commits, and SHA-256 IOCs.
- Keep tone factual and professional; avoid speculation.
- Copy the exact message to macOS clipboard using `pbcopy`.

Use this pattern:

```bash
ABUSE_MESSAGE='<paste the full report-abuse message here>'
echo "$ABUSE_MESSAGE" | pbcopy
```

Then include the same report-abuse message in the response under:

```md
GitHub report-abuse message
<content>
```

## Quality bar

- Do not claim malware conclusively without evidence.
- Do not downplay malicious packaging behavior.
- Include exact file paths and commit IDs for all high/critical findings.
- If no major issue is found, explicitly state why and what was checked.
