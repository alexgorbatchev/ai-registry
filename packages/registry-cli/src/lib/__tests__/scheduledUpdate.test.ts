import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, chmod } from "node:fs/promises";
import { join, resolve } from "node:path";

import { scheduledUpdate } from "../scheduledUpdate";

const testDirectories: string[] = [];

async function run(cwd: string, cmd: string[]): Promise<string> {
  const subprocess = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
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
  await Bun.write(join(remotePath, ".gitignore"), ".tmp/\n");
  await Bun.write(join(remotePath, "content.txt"), "initial\n");
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

  it("rejects tracked local edits before pulling", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await advanceRemote(remotePath);
    await Bun.write(join(repositoryPath, "content.txt"), "local\n");
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow(
      "Tracked local changes exist. Commit or stash them before running the scheduled update.",
    );
    expect(await Bun.file(join(repositoryPath, "content.txt")).text()).toBe("local\n");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("does not bootstrap after a failed pull", async () => {
    const { repositoryPath } = await createRepository();
    await run(repositoryPath, ["git", "remote", "set-url", "origin", join(repositoryPath, "missing")]);
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow("Command failed (exit code 1): git");
    expect(await Bun.file(join(repositoryPath, ".tmp/bootstrap-count")).exists()).toBe(false);
  });

  it("refuses divergent history even when rebase and autostash are configured", async () => {
    const { remotePath, repositoryPath } = await createRepository();
    await advanceRemote(remotePath);
    await run(repositoryPath, ["git", "config", "pull.rebase", "true"]);
    await run(repositoryPath, ["git", "config", "merge.autostash", "true"]);
    await run(repositoryPath, ["git", "-c", "user.name=Test Author", "-c", "user.email=test@example.invalid",
      "commit", "--allow-empty", "-m", "local"]);
    const before = await run(repositoryPath, ["git", "rev-parse", "HEAD"]);
    await expect(scheduledUpdate(repositoryPath, process.execPath)).rejects.toThrow("Command failed (exit code 128): git");
    expect(await run(repositoryPath, ["git", "rev-parse", "HEAD"])).toBe(before);
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
