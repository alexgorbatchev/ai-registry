import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { pruneScheduledUpdateLog } from "../pruneScheduledUpdateLog";
import { REPOSITORY_ROOT } from "./helpers";

const testDirectories: string[] = [];

async function createLogPath(): Promise<string> {
  const parentPath = resolve(REPOSITORY_ROOT, ".tmp/scheduled-log-tests");
  await mkdir(parentPath, { recursive: true });
  const directory = await mkdtemp(join(parentPath, "logs with 'quotes' "));
  testDirectories.push(directory);
  return join(directory, "scheduled-update.log");
}

afterEach(async () => {
  for (const directory of testDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("pruneScheduledUpdateLog", () => {
  it.each([
    ["2026-03-09T19:00:00Z", "2026-03-07 10:59", "2026-03-07 11:00"],
    ["2026-11-02T20:00:00Z", "2026-10-31 12:59", "2026-10-31 13:00"],
  ])("retains 48 elapsed hours across daylight-saving changes at %s", async (instant, expired, retained) => {
    const logPath = await createLogPath();
    await Bun.write(logPath, `[${expired}] expired\n[${retained}] retained\n`);
    const sourcePath = resolve(REPOSITORY_ROOT, "packages/registry-cli/src/lib/pruneScheduledUpdateLog.ts");
    const subprocess = Bun.spawn([process.execPath, "-e", [
      `import { pruneScheduledUpdateLog } from ${JSON.stringify(sourcePath)};`,
      `await pruneScheduledUpdateLog(${JSON.stringify(logPath)}, new Date(${JSON.stringify(instant)}));`,
    ].join("\n")], {
      env: { ...process.env, TZ: "America/Los_Angeles" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [output, error, exitCode] = await Promise.all([
      new Response(subprocess.stdout).text(),
      new Response(subprocess.stderr).text(),
      subprocess.exited,
    ]);
    expect(exitCode, error).toBe(0);
    expect(output).toBe("");
    expect(await Bun.file(logPath).text()).toBe(`[${retained}] retained\n`);
  });

  it("keeps the last 48 hours at log minute precision, including the cutoff minute", async () => {
    const logPath = await createLogPath();
    await Bun.write(logPath, [
      "[2026-10-13 12:00] old",
      "[2026-10-14 11:59] expired",
      "[2026-10-14 12:00] boundary",
      "[2026-10-15 12:00] café",
      "[2026-10-16 12:00] ",
      "[2026-10-16 12:00] last",
    ].join("\n"));
    await pruneScheduledUpdateLog(logPath, new Date(2026, 9, 16, 12, 0, 59));
    expect(await Bun.file(logPath).text()).toBe([
      "[2026-10-14 12:00] boundary",
      "[2026-10-15 12:00] café",
      "[2026-10-16 12:00] ",
      "[2026-10-16 12:00] last",
      "",
    ].join("\n"));
    expect(await Bun.file(`${logPath}.pruning`).exists()).toBe(false);
  });

  it("empties an entirely expired log and discards entries with no supported timestamp", async () => {
    const logPath = await createLogPath();
    await Bun.write(logPath, "untimestamped\n[2000-01-01 00:00] old\n[invalid] malformed\n");
    await pruneScheduledUpdateLog(logPath, new Date(2026, 9, 16));
    expect(await Bun.file(logPath).text()).toBe("");
  });

  it("leaves a missing log absent", async () => {
    const logPath = await createLogPath();
    await pruneScheduledUpdateLog(logPath);
    expect(await Bun.file(logPath).exists()).toBe(false);
  });

  it("preserves an empty log", async () => {
    const logPath = await createLogPath();
    await Bun.write(logPath, "");
    await pruneScheduledUpdateLog(logPath);
    expect(await Bun.file(logPath).text()).toBe("");
  });

  it("preserves the original log when the replacement cannot be written", async () => {
    const logPath = await createLogPath();
    await Bun.write(logPath, "[2000-01-01 00:00] original\n");
    await mkdir(`${logPath}.pruning`);
    await expect(pruneScheduledUpdateLog(logPath)).rejects.toThrow();
    expect(await Bun.file(logPath).text()).toBe("[2000-01-01 00:00] original\n");
  });
});
