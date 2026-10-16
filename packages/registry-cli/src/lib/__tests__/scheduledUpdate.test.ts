import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, chmod } from "node:fs/promises";
import { join, resolve } from "node:path";

import { scheduledUpdate } from "../scheduledUpdate";
import { readTimestampedLog } from "./helpers";

const testDirectories: string[] = [];

async function run(cwd: string, cmd: string[]): Promise<string> {
  const subprocess = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, AGENT: "0", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);
  expect(exitCode, stderr).toBe(0);
  return stdout.trim();
}

async function createRepository() {
  const parentPath = resolve(".tmp/scheduled-update-tests");
  await mkdir(parentPath, { recursive: true });
  const testPath = await mkdtemp(join(parentPath, "run-"));
  testDirectories.push(testPath);
  const remotePath = join(testPath, "remote");
  const repositoryPath = join(testPath, "checkout");
  await run(testPath, ["git", "init", "--initial-branch=main", remotePath]);
  await run(remotePath, ["git", "config", "user.name", "Test Author"]);
  await run(remotePath, ["git", "config", "user.email", "test@example.invalid"]);
  await run(remotePath, ["git", "config", "receive.denyCurrentBranch", "updateInstead"]);
  await Bun.write(join(remotePath, ".gitignore"), ".tmp/\n");
  await Bun.write(join(remotePath, "content.txt"), "initial\n");
  await Bun.write(join(remotePath, "local.txt"), "initial\n");
  await Bun.write(join(remotePath, "package.json"), JSON.stringify({ scripts: { bootstrap: "bun bootstrap.ts" } }));
  await Bun.write(join(remotePath, "bootstrap.ts"), [
    'await Bun.write(".tmp/bootstrap-args.json", JSON.stringify(process.argv.slice(2)));',
    'if (await Bun.file(".tmp/fail-bootstrap").exists()) process.exit(7);',
    'const file = Bun.file(".tmp/bootstrap-count");',
    'const count = await file.exists() ? Number(await file.text()) : 0;',
    'await Bun.write(file, String(count + 1));',
  ].join("\n"));
  await run(remotePath, ["git", "add", "."]);
  await run(remotePath, ["git", "commit", "-m", "initial"]);
  await run(testPath, ["git", "clone", remotePath, repositoryPath]);
  return { remotePath, repositoryPath };
}

async function advanceRemote(remotePath: string): Promise<void> {
  await Bun.write(join(remotePath, "content.txt"), "updated\n");
  await run(remotePath, ["git", "add", "content.txt"]);
  await run(remotePath, ["git", "commit", "-m", "update"]);
}

afterEach(async () => {
  for (const directory of testDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("scheduledUpdate", () => {
  it("runs the locked entrypoint from another working directory", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    for (const sourcePath of [
      "packages/registry-cli/src/bin/scheduled-update.ts",
      "packages/registry-cli/src/bin/scheduled-update-worker.ts",
      "packages/registry-cli/src/lib/runLockedScheduledUpdate.ts",
      "packages/registry-cli/src/lib/writeTimestampedOutput.ts",
      "packages/registry-cli/src/lib/scheduledUpdate.ts",
      "packages/registry-cli/src/lib/pullWithRebase.ts",
      "packages/registry-cli/src/lib/pushScheduledCommits.ts",
      "packages/registry-cli/src/lib/getErrorMessage.ts",
    ]) {
      await Bun.write(join(repositoryPath, sourcePath), Bun.file(resolve(sourcePath)));
    }
    expect(await run(remotePath, [process.execPath, join(repositoryPath,
      "packages/registry-cli/src/bin/scheduled-update.ts")])).toBe(
      `[OK] scheduled update: completed; log: ${repositoryPath}/.tmp/scheduled-update.log`,
    );
    expect(await readTimestampedLog(join(repositoryPath, ".tmp/scheduled-update.log"))).toBe(
      "Already up to date.\n[OK] scheduled update: unchanged\n",
    );
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("skips bootstrap when the pull does not change HEAD", async () => {
    const { repositoryPath } = await createRepository();
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("unchanged");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("pulls commits and bootstraps once with auto-confirm while suppressing Git hooks", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    const hooksPath = join(repositoryPath, ".git/hooks");
    const hookPath = join(hooksPath, "post-merge");
    await Bun.write(hookPath, '#!/bin/sh\nprintf hook > .tmp/hook-ran\n');
    await chmod(hookPath, 0o755);
    await advanceRemote(remotePath);
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("bootstrapped");
    expect(await Bun.file(join(repositoryPath, "content.txt")).text()).toBe("updated\n");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).text()).toBe("1");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-args.json")).json()).toEqual(["-y"]);
    expect(await Bun.file(join(repositoryPath, ".tmp/hook-ran")).exists()).toBe(false);
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("unchanged");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).text()).toBe("1");
  });

  it("rolls back HEAD and local edits when restoring the stash conflicts", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await advanceRemote(remotePath);
    await run(repositoryPath, ["git", "config", "merge.autostash", "true"]);
    await Bun.write(join(repositoryPath, "content.txt"), "local\n");
    const before = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    const status = await run(repositoryPath, ["git", "status", "--porcelain"]);
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow(
      "Command failed (exit code 1): git",
    );
    expect(await run(repositoryPath, ["git", "rev-parse", "HEAD"])).toBe(before);
    expect(await run(repositoryPath, ["git", "status", "--porcelain"])).toBe(status);
    expect(await run(repositoryPath, ["git", "stash", "list"])).toBe("");
    expect(await run(repositoryPath, ["git", "diff", "--name-only", "--diff-filter=U"])).toBe("");
    expect(await Bun.file(join(repositoryPath, "content.txt")).text()).toBe("local\n");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("updates a dirty checkout while preserving staged, unstaged and untracked changes", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await Bun.write(join(repositoryPath, "local.txt"), "staged\n");
    await run(repositoryPath, ["git", "add", "local.txt"]);
    await Bun.write(join(repositoryPath, "local.txt"), "unstaged\n");
    await Bun.write(join(repositoryPath, "untracked.txt"), "untracked\n");
    const staged = await run(repositoryPath, ["git", "diff", "--cached"]);
    const unstaged = await run(repositoryPath, ["git", "diff"]);
    const status = await run(repositoryPath, ["git", "status", "--porcelain"]);
    await advanceRemote(remotePath);
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("bootstrapped");
    expect(await Bun.file(join(repositoryPath, "content.txt")).text()).toBe("updated\n");
    expect(await run(repositoryPath, ["git", "diff", "--cached"])).toBe(staged);
    expect(await run(repositoryPath, ["git", "diff"])).toBe(unstaged);
    expect(await run(repositoryPath, ["git", "status", "--porcelain"])).toBe(status);
    expect(await Bun.file(join(repositoryPath, "untracked.txt")).text()).toBe("untracked\n");
    expect(await run(repositoryPath, ["git", "stash", "list"])).toBe("");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).text()).toBe("1");
  });

  it("skips bootstrap in a dirty checkout when no new commits arrive", async () => {
    const { repositoryPath } = await createRepository();
    await Bun.write(join(repositoryPath, "content.txt"), "local\n");
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("unchanged");
    expect(await Bun.file(join(repositoryPath, "content.txt")).text()).toBe("local\n");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("refuses incoming files that would overwrite untracked files", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await Bun.write(join(repositoryPath, "new.txt"), "local untracked\n");
    await Bun.write(join(remotePath, "new.txt"), "incoming\n");
    await run(remotePath, ["git", "add", "new.txt"]);
    await run(remotePath, ["git", "commit", "-m", "new file"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", "local"]);
    await Bun.write(join(repositoryPath, "local.txt"), "dirty local\n");
    const before = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow("Command failed (exit code 1): git");
    expect(await run(repositoryPath, ["git", "rev-parse", "HEAD"])).toBe(before);
    expect(await Bun.file(join(repositoryPath, "new.txt")).text()).toBe("local untracked\n");
    expect(await Bun.file(join(repositoryPath, "local.txt")).text()).toBe("dirty local\n");
    expect(await run(repositoryPath, ["git", "stash", "list"])).toBe("");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("does not bootstrap after a failed pull", async () => {
    const { repositoryPath } = await createRepository();
    await run(repositoryPath, ["git", "remote", "set-url", "origin", join(repositoryPath, "missing")]);
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow("Command failed (exit code 1): git");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("rebases divergent local commits even when fast-forward-only pulls are configured", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await advanceRemote(remotePath);
    const incoming = await run(remotePath, ["git", "rev-parse", "HEAD"]);
    await run(repositoryPath, ["git", "config", "pull.rebase", "true"]);
    await run(repositoryPath, ["git", "config", "pull.ff", "only"]);
    await run(repositoryPath, ["git", "config", "merge.autostash", "true"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", "local"]);
    const before = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    await run(repositoryPath, ["git", "branch", "other-branch"]);
    await run(repositoryPath, ["git", "config", "rebase.updateRefs", "true"]);
    const hooksPath = join(repositoryPath, ".git/hooks");
    await Bun.write(join(hooksPath, "post-rewrite"), "#!/bin/sh\nmkdir -p .tmp\nprintf rewritten > .tmp/hook-ran\n");
    await chmod(join(hooksPath, "post-rewrite"), 0o755);
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("bootstrapped-and-pushed");
    expect(await run(repositoryPath, ["git", "rev-parse", "HEAD^"])).toBe(incoming);
    expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(
      await run(repositoryPath, ["git", "rev-parse", "HEAD"]),
    );
    expect(await run(repositoryPath, ["git", "log", "-1", "--format=%s"])).toBe("local");
    expect(await run(repositoryPath, ["git", "rev-parse", "other-branch"])).toBe(before);
    expect(await Bun.file(join(repositoryPath, ".tmp/hook-ran")).exists()).toBe(false);
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).text()).toBe("1");
  });

  it("rebases with dirty staged and unstaged edits while retaining an existing stash", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await Bun.write(join(repositoryPath, "local.txt"), "older stash\n");
    await run(repositoryPath, ["git", "stash", "push", "-m", "user stash"]);
    const previousStash = await run(repositoryPath, ["git", "stash", "list", "--format=%H"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", "local"]);
    await Bun.write(join(repositoryPath, "local.txt"), "staged\n");
    await run(repositoryPath, ["git", "add", "local.txt"]);
    await Bun.write(join(repositoryPath, "local.txt"), "unstaged\n");
    const staged = await run(repositoryPath, ["git", "diff", "--cached"]);
    const unstaged = await run(repositoryPath, ["git", "diff"]);
    await advanceRemote(remotePath);
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("bootstrapped-and-pushed");
    expect(await run(repositoryPath, ["git", "diff", "--cached"])).toBe(staged);
    expect(await run(repositoryPath, ["git", "diff"])).toBe(unstaged);
    expect(await run(repositoryPath, ["git", "stash", "list", "--format=%H"])).toBe(previousStash);
  });

  it("pushes local commits without bootstrapping when the pull has no new commits", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", "local"]);
    await Bun.write(join(repositoryPath, "local.txt"), "uncommitted\n");
    const head = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("pushed");
    expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(head);
    expect(await Bun.file(join(repositoryPath, "local.txt")).text()).toBe("uncommitted\n");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("unchanged");
  });

  it("skips pushing when there are no outgoing commits", async () => {
    const { repositoryPath } = await createRepository();
    const hookPath = join(repositoryPath, ".git/hooks/pre-push");
    await Bun.write(hookPath, "#!/bin/sh\nprintf attempted > .tmp/push-attempted\nexit 1\n");
    await chmod(hookPath, 0o755);
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("unchanged");
    expect(await Bun.file(join(repositoryPath, ".tmp/push-attempted")).exists()).toBe(false);
  });

  it("retries a rejected push without repeating a successful bootstrap", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    const remoteBefore = await run(remotePath, ["git", "rev-parse", "HEAD"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", "local"]);
    const hookPath = join(remotePath, ".git/hooks/pre-receive");
    await Bun.write(hookPath, "#!/bin/sh\nexit 1\n");
    await chmod(hookPath, 0o755);
    await Bun.write(join(repositoryPath, ".tmp/scheduled-update-pending"), "retry bootstrap");
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow("Command failed (exit code 1)");
    const head = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(remoteBefore);
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).text()).toBe("1");
    expect(await Bun.file(join(repositoryPath, ".tmp/scheduled-update-pending")).exists()).toBe(false);
    await Bun.file(hookPath).delete();
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("pushed");
    expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(head);
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).text()).toBe("1");
  });

  it("does not push local commits until pending bootstrap succeeds", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    const remoteBefore = await run(remotePath, ["git", "rev-parse", "HEAD"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", "local"]);
    await Bun.write(join(repositoryPath, ".tmp/scheduled-update-pending"), "retry bootstrap");
    await Bun.write(join(repositoryPath, ".tmp/fail-bootstrap"), "fail");
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow("Command failed (exit code 7)");
    expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(remoteBefore);
    await Bun.file(join(repositoryPath, ".tmp/fail-bootstrap")).delete();
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("bootstrapped-and-pushed");
    expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(
      await run(repositoryPath, ["git", "rev-parse", "HEAD"]),
    );
  });

  it("pushes only the upstream branch despite other push defaults and local tags", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await run(repositoryPath, ["git", "branch", "-m", "work"]);
    await run(repositoryPath, ["git", "remote", "rename", "origin", "publish"]);
    await run(repositoryPath, ["git", "config", "remote.pushDefault", "nonexistent"]);
    await run(repositoryPath, ["git", "config", "remote.publish.mirror", "true"]);
    await run(repositoryPath, ["git", "config", "push.followTags", "true"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", "local"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "tag", "-a", "local-tag", "-m", "local tag"]);
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("pushed");
    expect(await run(remotePath, ["git", "rev-parse", "main"])).toBe(
      await run(repositoryPath, ["git", "rev-parse", "work"]),
    );
    expect(await run(remotePath, ["git", "for-each-ref", "--format=%(refname)"])).toBe("refs/heads/main");
  });

  it("keeps both sides intact when the remote advances between pull and push", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", "local"]);
    const head = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    const hookPath = join(repositoryPath, ".git/hooks/pre-push");
    await Bun.write(hookPath, `#!/bin/sh\ngit -C '${remotePath}' commit --allow-empty -m race\n`);
    await chmod(hookPath, 0o755);
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow("Command failed (exit code 1)");
    expect(await run(repositoryPath, ["git", "rev-parse", "HEAD"])).toBe(head);
    expect(await run(remotePath, ["git", "log", "-1", "--format=%s"])).toBe("race");
    await Bun.file(hookPath).delete();
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("bootstrapped-and-pushed");
    expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(
      await run(repositoryPath, ["git", "rev-parse", "HEAD"]),
    );
  });

  it.each([
    "https://github.com/example/registry.git",
    "git@github.com:example/registry.git",
    "ssh://git@github.com/example/registry.git",
    "ssh://git@ssh.github.com:443/example/registry.git",
    "https://github.com/example/registry.git\nssh://git@example.invalid/registry.git",
  ])("blocks private content in outgoing history to %s even when later removed", async (destination) => {
    const { remotePath, repositoryPath } = await createRepository();
    const remoteBefore = await run(remotePath, ["git", "rev-parse", "HEAD"]);
    await Bun.write(join(repositoryPath, "private.txt"), ["internal", "cvb", "lol"].join("."));
    await run(repositoryPath, ["git", "add", "private.txt"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "-m", "add content"]);
    await run(repositoryPath, ["git", "rm", "private.txt"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "-m", "remove content"]);
    const overrides = new Map([["git remote get-url --push --all origin", destination]]);
    await expect(scheduledUpdate(repositoryPath, process.execPath, async (cmd) => (
      overrides.get(cmd.join(" ")) ?? run(repositoryPath, cmd)
    ))).rejects.toThrow(
      "Push blocked: outgoing commits contain private internal domains. Anonymize them before retrying.",
    );
    expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(remoteBefore);
  });

  it("blocks private domains in outgoing commit messages before pushing to GitHub", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    const remoteBefore = await run(remotePath, ["git", "rev-parse", "HEAD"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", ["INTERNAL", "ZXC", "LOL"].join(".")]);
    const overrides = new Map([["git remote get-url --push --all origin", "https://github.com/example/registry.git"]]);
    await expect(scheduledUpdate(repositoryPath, process.execPath, async (cmd) => (
      overrides.get(cmd.join(" ")) ?? run(repositoryPath, cmd)
    ))).rejects.toThrow(
      "Push blocked: outgoing commits contain private internal domains. Anonymize them before retrying.",
    );
    expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(remoteBefore);
  });

  it("allows public outgoing content after inspecting GitHub destinations", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", "public content"]);
    const overrides = new Map([["git remote get-url --push --all origin", "https://github.com/example/registry.git"]]);
    expect(await scheduledUpdate(repositoryPath, process.execPath, async (cmd) => (
      overrides.get(cmd.join(" ")) ?? run(repositoryPath, cmd)
    ))).toBe("pushed");
    expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(
      await run(repositoryPath, ["git", "rev-parse", "HEAD"]),
    );
  });

  it("supports file URLs for an upstream remote", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await run(repositoryPath, ["git", "remote", "set-url", "origin", `file://${remotePath}`]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", "local"]);
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("pushed");
    expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(
      await run(repositoryPath, ["git", "rev-parse", "HEAD"]),
    );
  });

  it.each(["transport::unknown", "", "ftp://example.invalid/registry.git",
    "https://github.com/example/registry.git\ntransport::unknown"])(
    "refuses a push when a destination cannot be verified: %s", async (destination) => {
      const { remotePath, repositoryPath } = await createRepository();
      const remoteBefore = await run(remotePath, ["git", "rev-parse", "HEAD"]);
      await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
        "commit", "--allow-empty", "-m", "local"]);
      const overrides = new Map([["git remote get-url --push --all origin", destination]]);
      await expect(scheduledUpdate(repositoryPath, process.execPath, async (cmd) => (
        overrides.get(cmd.join(" ")) ?? run(repositoryPath, cmd)
      ))).rejects.toThrow("Cannot determine the push destination; inspect the upstream remote before retrying.");
      expect(await run(remotePath, ["git", "rev-parse", "HEAD"])).toBe(remoteBefore);
    },
  );

  it("merges non-overlapping local and incoming edits within the same file", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    const initial = "first\n" + "unchanged\n".repeat(12) + "last\n";
    await Bun.write(join(remotePath, "content.txt"), initial);
    await run(remotePath, ["git", "add", "content.txt"]);
    await run(remotePath, ["git", "commit", "-m", "multiline"]);
    await run(repositoryPath, ["git", "pull", "--ff-only"]);
    await Bun.write(join(repositoryPath, "content.txt"), initial.replace("first", "local"));
    await Bun.write(join(remotePath, "content.txt"), initial.replace("last", "incoming"));
    await run(remotePath, ["git", "add", "content.txt"]);
    await run(remotePath, ["git", "commit", "-m", "incoming"]);
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("bootstrapped");
    expect(await Bun.file(join(repositoryPath, "content.txt")).text()).toBe(
      initial.replace("first", "local").replace("last", "incoming"),
    );
    expect(await run(repositoryPath, ["git", "stash", "list"])).toBe("");
  });

  it("aborts a conflicting rebase and restores dirty edits without bootstrapping", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await Bun.write(join(repositoryPath, "content.txt"), "local committed\n");
    await run(repositoryPath, ["git", "add", "content.txt"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "-m", "local"]);
    await Bun.write(join(repositoryPath, "local.txt"), "dirty\n");
    const before = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    const status = await run(repositoryPath, ["git", "status", "--porcelain"]);
    await advanceRemote(remotePath);
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow("Command failed (exit code 1): git");
    expect(await run(repositoryPath, ["git", "rev-parse", "HEAD"])).toBe(before);
    expect(await run(repositoryPath, ["git", "status", "--porcelain"])).toBe(status);
    expect(await Bun.file(join(repositoryPath, "content.txt")).text()).toBe("local committed\n");
    expect(await Bun.file(join(repositoryPath, "local.txt")).text()).toBe("dirty\n");
    expect(await run(repositoryPath, ["git", "stash", "list"])).toBe("");
    expect(await run(repositoryPath, ["git", "diff", "--name-only", "--diff-filter=U"])).toBe("");
    expect(await Bun.file(join(repositoryPath, ".tmp/scheduled-update-recovery.json")).exists()).toBe(false);
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("preserves staged and unstaged edits and older stashes after restoration fails", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await Bun.write(join(repositoryPath, "local.txt"), "older stash\n");
    await run(repositoryPath, ["git", "stash", "push", "-m", "user stash"]);
    const previousStash = await run(repositoryPath, ["git", "stash", "list", "--format=%H"]);
    await Bun.write(join(repositoryPath, "content.txt"), "staged local\n");
    await run(repositoryPath, ["git", "add", "content.txt"]);
    await Bun.write(join(repositoryPath, "content.txt"), "unstaged local\n");
    const before = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    const staged = await run(repositoryPath, ["git", "diff", "--cached"]);
    const unstaged = await run(repositoryPath, ["git", "diff"]);
    await advanceRemote(remotePath);
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow("rolled back");
    expect(await run(repositoryPath, ["git", "rev-parse", "HEAD"])).toBe(before);
    expect(await run(repositoryPath, ["git", "diff", "--cached"])).toBe(staged);
    expect(await run(repositoryPath, ["git", "diff"])).toBe(unstaged);
    expect(await run(repositoryPath, ["git", "stash", "list", "--format=%H"])).toBe(previousStash);
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("stops before pulling when an interrupted update needs recovery", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await advanceRemote(remotePath);
    const before = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    await Bun.write(join(repositoryPath, ".tmp/scheduled-update-recovery.json"), JSON.stringify({ before }));
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow(
      "An interrupted update needs recovery.",
    );
    expect(await run(repositoryPath, ["git", "rev-parse", "HEAD"])).toBe(before);
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("leaves an existing conflicted rebase untouched", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await Bun.write(join(repositoryPath, "content.txt"), "local committed\n");
    await run(repositoryPath, ["git", "add", "content.txt"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "-m", "local"]);
    await advanceRemote(remotePath);
    await run(repositoryPath, ["git", "fetch"]);
    expect(Bun.spawnSync(["git", "-c", "core.hooksPath=/dev/null", "rebase", "origin/main"], {
      cwd: repositoryPath, stdout: "ignore", stderr: "ignore",
    }).exitCode).toBe(1);
    const before = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    const status = await run(repositoryPath, ["git", "status", "--porcelain"]);
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow(
      "Finish the existing Git operation before running a scheduled update.",
    );
    expect(await run(repositoryPath, ["git", "rev-parse", "HEAD"])).toBe(before);
    expect(await run(repositoryPath, ["git", "status", "--porcelain"])).toBe(status);
    expect(await Bun.file(join(repositoryPath, ".tmp/scheduled-update-recovery.json")).exists()).toBe(false);
  });

  it("keeps the saved stash and stops future runs when rollback cannot restore it", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await Bun.write(join(repositoryPath, "local.txt"), "saved dirty edits\n");
    const before = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    await advanceRemote(remotePath);
    const rejectedCommands = new Map([
      ["apply", () => Promise.reject(new Error("stash application failed"))],
    ]);
    await expect(scheduledUpdate(repositoryPath, process.execPath, async (cmd) => (
      rejectedCommands.get(cmd[cmd.indexOf("stash") + 1] ?? "")?.() ?? run(repositoryPath, cmd)
    ))).rejects.toThrow("Recovery failed: stash application failed");
    expect(await run(repositoryPath, ["git", "rev-parse", "HEAD"])).toBe(before);
    const stash = await run(repositoryPath, ["git", "rev-parse", "refs/stash"]);
    expect(await Bun.file(join(repositoryPath, ".tmp/scheduled-update-recovery.json")).json()).toEqual({
      before, label: expect.any(String), stash,
    });
    expect(await run(repositoryPath, ["git", "show", `${stash}:local.txt`])).toBe("saved dirty edits");
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow(
      "An interrupted update needs recovery.",
    );
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("retries failed bootstrap on the next run even without new commits", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await advanceRemote(remotePath);
    await Bun.write(join(repositoryPath, ".tmp/fail-bootstrap"), "fail");
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow("Command failed (exit code 7)");
    await Bun.file(join(repositoryPath, ".tmp/fail-bootstrap")).delete();
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("bootstrapped");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).text()).toBe("1");
    expect(await scheduledUpdate(repositoryPath, process.execPath)).toBe("unchanged");
  });
});
