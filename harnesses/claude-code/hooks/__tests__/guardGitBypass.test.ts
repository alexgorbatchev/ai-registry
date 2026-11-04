import { expect, test } from "bun:test";
import { join } from "node:path";
import { findViolation, runPreToolUse } from "../guardGitBypass";

const BLOCKED = [
  "git commit --no-verify -m skip",
  "git commit -n -m skip",
  "git commit -anm skip",
  "git -C repo commit --no-verify -m skip",
  "git push --no-verify origin main",
  "git am -n patch",
  "git add . && git commit --no-verify -m skip",
  "echo first\ngit push --no-verify",
  "echo $(git commit --no-verify -m skip)",
  "env git push --no-verify",
  "/usr/bin/git push --no-verify",
  "GIT_CONFIG_GLOBAL=/dev/null git commit -m skip",
  "env GIT_CONFIG_GLOBAL=/dev/null git push",
  "export GIT_CONFIG_GLOBAL=/dev/null",
  "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=hook.a.enabled GIT_CONFIG_VALUE_0=false git push",
  "git -c hook.gitleaks-staged.enabled=false commit -m skip",
  "git -c HOOK.gitleaks-staged.enabled=false commit -m skip",
  "git --config-env=hook.a.enabled=OFF push",
  "git --config-env hook.a.enabled=OFF push",
  "git config hook.gitleaks-staged.enabled false",
  "git config --global --unset hook.gitleaks-outgoing.command",
  "git config set hook.a.enabled false",
  "gh gist create notes.txt",
  "gh gist edit 123",
  "gh api gists -f description=x",
  "gh api -X POST /gists --input body.json",
  "gh api gists/123 --method PATCH --input body.json",
  "gh api -XPOST gists",
  "gh api --method=post gists",
  "gh api gists --raw-field description=x",
  "gh api gists --input=body.json",
  "gitleaks-disable--all",
  "gitleaks-disable--private-internal-domain",
  'bun "$HOME/.dotfiles/tools/gitleaks/disable.ts" all',
  "bash -c 'git commit --no-verify -m skip'",
  "sh -lc 'git push --no-verify'",
  'eval "git push --no-verify"',
  "name=${path%%/*}; git push --no-verify",
  "GIT_CONFIG_GLOBAL=/dev/null echo ${path%%/*}",
  "bash <<'EOF'\ngit push --no-verify\nEOF",
  "cat script | sh <<EOF\ngit push --no-verify\nEOF",
  "cat > notes <<EOF\nsafe\nEOF\ngit push --no-verify",
];

const ALLOWED = [
  "git commit -m 'explain why --no-verify is banned'",
  "git commit -m --no-verify-mentioned",
  "git log --grep=--no-verify",
  "git status",
  "git merge -n feature",
  "git pull -n",
  "git -c user.name=Test commit -m normal",
  "git -c core.hooksPath=.githooks status",
  "git -C repo status",
  "git config --get hook.gitleaks-staged.command",
  "git config --list",
  "git config user.name Test",
  "grep -- --no-verify README.md",
  "echo GIT_CONFIG_GLOBAL",
  "rg GIT_CONFIG_GLOBAL workspace/scripts",
  "gh gist list",
  "gh gist view 123",
  "gh pr view 7",
  "gh api repos/acme/widgets/gists-report",
  "gh api users/acme/gists --paginate --jq length",
  "gh api gists/123",
  "gh api --method GET gists -f per_page=100",
  "bash scripts/test.sh",
  "bash -c 'git status'",
  "just workspace test-gitleaks",
  'name=${path%%/*}; echo "$name"',
  'for s in a b; do p=${s%%|*}; git -C "$p" status; done',
  "# git commit --no-verify",
  "cat > script.sh <<'EOF'\ngit push --no-verify\nexport GIT_CONFIG_GLOBAL=/dev/null\nEOF",
  "git commit -F- <<EOF\ngit push --no-verify\nEOF",
  "python3 - <<'PY'\ngit push --no-verify\nPY",
  "cat <<EOF\nEOF",
  "",
];

test.each(BLOCKED)("blocks %s", (command) => {
  expect(findViolation(command)).toBeString();
});

test.each(ALLOWED)("allows %s", (command) => {
  expect(findViolation(command)).toBeUndefined();
});

test("denies through the native decision and stays silent otherwise", () => {
  const output = JSON.parse(runPreToolUse({ tool_input: { command: "git push --no-verify" } }));
  expect(output.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
  expect(output.hookSpecificOutput.permissionDecisionReason).toContain("--no-verify");
  expect(runPreToolUse({ tool_input: { command: "git status" } })).toBe("");
});

test("rejects input without a command", () => {
  expect(() => runPreToolUse(null)).toThrow("tool_input");
  expect(() => runPreToolUse({ tool_input: { file_path: "file" } })).toThrow("command");
});

test("blocks through the process contract and fails closed on invalid input", async () => {
  const script = join(import.meta.dir, "../guardGitBypass.ts");
  const run = async (stdin: string) => {
    const process = Bun.spawn(["bun", script], { stdin: new Blob([stdin]), stdout: "pipe", stderr: "pipe" });
    const [output, exitCode] = await Promise.all([new Response(process.stdout).text(), process.exited]);
    return { output, exitCode };
  };
  const denied = await run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git push --no-verify" } }));
  expect(denied.exitCode).toBe(0);
  expect(JSON.parse(denied.output).hookSpecificOutput.permissionDecision).toBe("deny");
  expect(await run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git status" } }))).toEqual({
    output: "",
    exitCode: 0,
  });
  expect((await run("not json")).exitCode).toBe(2);
});
