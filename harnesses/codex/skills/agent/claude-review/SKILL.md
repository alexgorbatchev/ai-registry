---
name: claude-review
description: Use when delegating code, diff, plan, or implementation reviews from Codex to Claude Code CLI, including requests for a Claude review subagent or an independent Opus 5.5 review.
author: alexgorbatchev
metadata:
  created_on: 2026-10-25 06:49
  last_modified: 2026-10-25 07:01
  status: current
---

# Claude Review

Run Claude Code as an independent, noninteractive reviewer from Codex. Pin **Opus 5.5** and **high effort** with `--model claude-opus-5-5 --effort high`. Keep implementation and final judgment with Codex; delegate inspection and findings to Claude.

## Prepare the review

1. Resolve the project root and read its applicable `AGENTS.md` instructions. Confirm the requested scope: working changes, a commit range, selected files, or a plan. Infer an unambiguous scope from the active task; ask only when choosing would materially change the review.
2. Check `claude --version`, `claude --help`, and `claude --safe-mode --restricted auth status` in the same environment and modes used for the review. Require **Claude Code v2.1.295 or later**: Opus 5.5 support starts at v2.1.280, but v2.1.295 fixes tool restrictions missing tools registered after launch. Require the flags used below. Confirm that the reported authentication method and provider match the intended account and billing route. Inspect the presence, without printing credential values, of `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, and third-party provider selectors. These modes ignore ordinary settings, including their `env` and `apiKeyHelper` entries: if the intended route depends on them, explicitly supply the necessary provider/auth configuration with `--settings <file>` to both the auth check and review, or establish the intended process environment before both commands. Keep that file outside the repository and include only required settings, never unrelated customizations. Resolve unintended inherited overrides for this process; preserve intentionally configured providers. Do not assume a saved subscription login means API credentials or a gateway are inactive. If authentication or the version blocks execution, report the observed error and the needed sign-in or update; do not change installation or account settings without authorization.
3. Create a unique temporary directory outside the project with `mktemp -d` and set `review_dir` to it. Capture stable raw evidence there with command-output redirection rather than reconstructing diffs through the model. Record the current commit and relevant working-tree state. For branch reviews, resolve the base with `git merge-base <base> HEAD`, then redirect `git diff --no-ext-diff --no-textconv --no-color <merge-base> HEAD` to a patch file. For working changes, redirect `git diff --no-ext-diff --no-textconv --no-color` and its `--cached` variant to separate patch files, and identify relevant untracked files. Name selected paths explicitly when reviewing a subset. Include relevant callers, contracts, documentation changes, and test results. Omit credential files and secret values unless sharing them with this reviewer is authorized; record any resulting coverage gap. Do not pass truncated or silently redacted evidence as a complete review.
4. Using the available file-editing tool, create `prompt.md` in that directory from [the review prompt](references/review-prompt.md). Replace every placeholder with the actual task, requirements, scope, applicable project instructions, and exact paths to the captured evidence or plan. Claude reads those files directly; do not retype their contents. Give Claude raw evidence rather than Codex's suspected answer.
5. Run from the project root so file reads resolve correctly. The reviewer has no Bash tool, so Codex supplies Git diffs, codegraph evidence when required by the project, and any necessary test output. Claude can inspect additional files through Read, Glob, and Grep. Include out-of-root evidence in the prompt, or add only the relevant authorized directory with `--add-dir <absolute-directory>`; the tool list still permits only reads. Name ignored or otherwise undiscoverable evidence files by exact path. For a plan review, identify which files substantiate the plan and which decisions remain proposals.

## Invoke Claude

Set `review_dir` to the temporary directory created above. Run this command with the project root as the execution tool's working directory:

```sh
CLAUDE_CODE_EFFORT_LEVEL=high claude --print \
  --model claude-opus-5-5 --effort high \
  --safe-mode --restricted \
  --add-dir "$review_dir" \
  --tools 'Read,Glob,Grep' --allowedTools 'Read,Glob,Grep' \
  --permission-mode dontAsk \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --disable-slash-commands --no-session-persistence \
  --output-format json --max-turns 32 \
  < "$review_dir/prompt.md" \
  > "$review_dir/result.json" 2> "$review_dir/stderr.log"
```

- Set the environment effort as well as the flag because an inherited `CLAUDE_CODE_EFFORT_LEVEL` can override session choices. `high` controls adaptive reasoning; do not substitute `ultrathink`, `MAX_THINKING_TOKENS`, or the moving `opus` alias. Opus 5.5 always uses adaptive thinking and defaults to `medium` without an override.
- `--tools` limits the built-in tool set; `--allowedTools` preapproves those reads. `--permission-mode dontAsk` denies requests needing further approval. Do not add Bash, edit tools, Agent, permission bypass, or fallback models to get a review through.
- `--safe-mode` disables customizations such as project instructions, skills, plugins, and hooks. Supply applicable project rules in the prompt. `--restricted` also confines file tools to working directories and ignores ordinary user/project/local settings. The explicit empty MCP configuration prevents configured MCP servers from loading. Managed policy still applies; these options are not an OS sandbox.
- Preserve subscription authentication: `--bare` skips OAuth and keychain credentials, so it is not a substitute for these flags on a subscription login.
- Use the execution tool's persistent process/session support when the command exceeds a short wait. Continue polling the same process, keeping the user informed; a timeout is not a review result. Do not start a duplicate billable run while the original still executes.
- The 32-turn cap bounds a run, not the review's scope. If it stops early, inspect the result and rerun with a larger cap or split independent scopes while preserving complete coverage. `--no-session-persistence` means this run cannot be resumed with `--resume` or `--continue`.
- On v2.1.304, some gateway/third-party routes fail when ToolSearch is excluded; v2.1.305 fixes that regression. If encountered, report the version and needed update instead of adding tools or retrying unchanged.

## Validate and use the result

1. Require exit code zero and valid JSON. Inspect stderr and the result envelope before extracting the review. A failed run may put its error on stdout. Require `type: "result"`, `subtype: "success"`, `is_error: false`, a nonempty `result`, and no `permission_denials`. A turn limit, authentication failure, blocked read, or missing result is an incomplete review, never approval.
2. Inspect `modelUsage`: require usage for `claude-opus-5-5` and investigate any other model key or mismatched `canonicalModel` before claiming the requested model reviewed the scope. Do not rely on the model naming itself in prose. A gateway's model label alone does not independently verify its upstream mapping; disclose that limitation if applicable. Record that high effort was requested through the launch configuration; the JSON envelope does not prove effective effort. Organization or managed policy can cap it, and JSON mode may send the cap warning only to debug logs. If stderr or available diagnostics report a cap, disclose it; absent such evidence, report high as requested rather than independently verified.
3. Read `result` and verify each finding against source, requirements, and actual behavior. Reject unsupported claims. Request a targeted follow-up with missing evidence when needed, using a fresh prompt with the relevant prior finding because sessions are not persisted.
4. Compare the reviewed commit and working changes with their captured state. If relevant inputs changed during review, review the changed scope before treating the result as current. Do not attribute unrelated concurrent edits to the reviewer or revert them.
5. Report confirmed findings with severity, exact file and line, impact, and a concrete correction. Separate unresolved questions and validation gaps. A clean result applies only to the inspected scope. Do not treat the review as authority to edit, commit, merge, push, or post comments beyond the user's existing authorization.
6. If fixes are already authorized, implement confirmed corrections in Codex, run appropriate checks, then review the resulting changes again. Otherwise return findings. Remove only disposable review files created for this task when no longer needed; retain failed-run artifacts while investigating.

## Sources

Check the installed CLI help and maintained docs again when behavior differs:

- [CLI reference](https://code.claude.com/docs/en/cli-reference): print mode, tool restrictions, safe/restricted modes, JSON output, and session flags.
- [Programmatic execution](https://code.claude.com/docs/en/headless): authentication in bare mode, exit status, and stdout failures.
- [Authentication](https://code.claude.com/docs/en/authentication): account, API-key, and provider routing.
- [Model configuration](https://code.claude.com/docs/en/model-config): exact model ID, minimum version, effort precedence, defaults, policy caps, and automatic fallback.
- [Opus 5.5 behavior](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5): always-on adaptive thinking.
- [Claude Code v2.1.295 changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md#21295): fixes enforcement of `--tools` and `--restricted` for tools registered after launch.
