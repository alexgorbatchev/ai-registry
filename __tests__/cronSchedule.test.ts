import { $, spawnSync } from "bun";
import { afterEach, expect, it } from "bun:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const repositoryPath = resolve(import.meta.dir, "..");
const directories: string[] = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

it("runs the rendered cron command inside its authorized checkout with Bun on PATH", async () => {
  const cronPersonPath = Bun.which("cron-person");
  assert(cronPersonPath, "Install cron-person to run the native schedule integration test");
  const parentPath = join(repositoryPath, ".tmp/cron-schedule-tests");
  await mkdir(parentPath, { recursive: true });
  const directory = await mkdtemp(join(parentPath, "run-"));
  directories.push(directory);
  const checkoutPath = join(directory, "checkout");
  const homePath = join(directory, "home");
  const bunPath = join(homePath, ".dotfiles/.generated/bin/bun");
  await mkdir(checkoutPath);
  await mkdir(join(homePath, ".dotfiles/.generated/bin"), { recursive: true });
  await Bun.write(join(checkoutPath, ".cronrc"), Bun.file(join(repositoryPath, ".cronrc")));
  await Bun.write(bunPath, "#!/bin/sh\npwd\nprintf '%s\\n' \"$@\"\n");
  await $`chmod +x ${bunPath}`;
  const environment = {
    HOME: homePath,
    XDG_STATE_HOME: join(directory, "state"),
    PATH: "/usr/bin:/bin",
    AGENT: "1",
  };
  const authorization = spawnSync([cronPersonPath, "allow", checkoutPath], { env: environment });
  expect(authorization.exitCode).toBe(0);
  const preview = spawnSync([cronPersonPath, "crontab", "show"], { env: environment });
  expect(preview.exitCode).toBe(0);
  const entry = preview.stdout.toString().split("\n").find((line) => line.startsWith("*/5 "));
  assert(entry);
  const command = entry.replace(/^(?:\S+\s+){5}/, "");
  const run = spawnSync(["/bin/sh", "-c", command], { cwd: homePath, env: environment });
  expect(run.stderr.toString()).toBe("");
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toBe(`${checkoutPath}\nrun\nscheduled:update\n`);

  const revocation = spawnSync([cronPersonPath, "deny", checkoutPath], { env: environment });
  expect(revocation.exitCode).toBe(0);
  const denied = spawnSync(["/bin/sh", "-c", command], { cwd: homePath, env: environment });
  expect(denied.exitCode).not.toBe(0);
  expect(denied.stdout.toString()).toBe("");
});
