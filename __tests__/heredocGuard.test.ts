import { spawnSync } from "bun";
import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

interface HookSettings {
  hooks: { PreToolUse: { matcher: string; hooks: { command: string }[] }[] };
}

const toolPath = resolve(import.meta.dir, "../tools/heredoc-guard/harnesses");
const harnesses = [
  { name: "claude-code", file: "claude-code/settings.json", fileTool: "Write tool" },
  { name: "codex", file: "codex/hooks.json", fileTool: "apply_patch" },
];
const shells = ["/bin/sh", "bash", "zsh", "dash"].filter((shell) => Bun.which(shell) !== null);

const blocked = [
  "cat > notes.txt <<EOF\nhello\nEOF",
  "cat > notes.txt <<'EOF'\nhello\nEOF",
  'cat > notes.txt <<"EOF"\nhello\nEOF',
  "cat <<-EOF\n\thello\n\tEOF",
  "cat << EOF\nhello\nEOF",
  "cat << 'EOF'\nhello\nEOF",
  "git commit -m \"$(cat <<'EOF'\nsubject\n\nbody\nEOF\n)\"",
  "python3 - <<PY\nprint(1)\nPY",
  "<<_END cat\nx\n_END",
  "cat <<\\EOF\nhello\nEOF",
  "cat <<- EOF\n\thello\n\tEOF",
];
const allowed = [
  "ls -la",
  'grep -c x <<< "$value"',
  'cat <<<"one"\necho two',
  "echo $((1<<2))\necho done",
  "echo 'a << b'",
  "git status\ngit log --oneline -3",
  `node -e 'console.log(["a"].join("\\n") + "  <<parent: x")'`,
];

async function readCommand(file: string): Promise<string> {
  const settings = (await Bun.file(resolve(toolPath, file)).json()) as HookSettings;
  const [entry] = settings.hooks.PreToolUse;
  const command = entry?.hooks[0]?.command;
  if (command === undefined) throw new Error(`${file} has no PreToolUse command`);
  return command;
}

/** Run the hook as the harness does: the command line under a shell, the compact JSON payload on stdin. */
function runHook(shell: string, command: string, bashCommand: string) {
  const payload = JSON.stringify({
    session_id: "session",
    cwd: "/work",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: bashCommand, description: "Run a command" },
  });
  const result = spawnSync([shell, "-c", command], { stdin: Buffer.from(payload) });
  return { exitCode: result.exitCode, stderr: result.stderr.toString() };
}

describe.each(harnesses)("$name heredoc guard", ({ file, fileTool }) => {
  it.each(shells)("blocks heredocs under %s with a file-tool instruction", async (shell) => {
    const command = await readCommand(file);
    for (const bashCommand of blocked) {
      const result = runHook(shell, command, bashCommand);
      expect({ bashCommand, exitCode: result.exitCode }).toEqual({ bashCommand, exitCode: 2 });
      expect(result.stderr).toContain(fileTool);
    }
  });

  // Shell glob matching backtracks quadratically on long lines full of "<<"; the hook must stay well inside its timeout.
  it.each(shells)("decides 100 KB commands quickly under %s", async (shell) => {
    const command = await readCommand(file);
    const cases = [
      { bashCommand: "x=$((a<<b)); ".repeat(8000), exitCode: 0 },
      { bashCommand: "echo a\\\\nb << c; ".repeat(6000), exitCode: 0 },
      { bashCommand: "echo hello;\n".repeat(9000), exitCode: 0 },
      { bashCommand: "x=$((a<<b));\n".repeat(8000), exitCode: 2 },
    ];
    for (const { bashCommand, exitCode } of cases) {
      const started = performance.now();
      expect(runHook(shell, command, bashCommand).exitCode).toBe(exitCode);
      expect(performance.now() - started).toBeLessThan(1500);
    }
  });

  it.each(shells)("allows commands without heredocs under %s", async (shell) => {
    const command = await readCommand(file);
    for (const bashCommand of allowed) {
      expect({ bashCommand, ...runHook(shell, command, bashCommand) }).toEqual({
        bashCommand,
        exitCode: 0,
        stderr: "",
      });
    }
  });
});
