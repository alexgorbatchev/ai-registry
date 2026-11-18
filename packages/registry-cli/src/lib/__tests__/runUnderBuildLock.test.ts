import { factory_testRoot } from "./fixtures";
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { BUILD_LOCK_HELD_ENV, getBuildLockPath, runUnderBuildLock } from "../runUnderBuildLock";

const PARENT_PATH = factory_testRoot("build-lock-tests");
const testDirectories: string[] = [];
const holders: Bun.Subprocess[] = [];

async function createDirectory(): Promise<string> {
  await mkdir(PARENT_PATH, { recursive: true });
  const directory = await mkdtemp(join(PARENT_PATH, "checkout "));
  testDirectories.push(directory);
  return directory;
}

async function waitForPath(path: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(path)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${path}`);
    await Bun.sleep(10);
  }
}

// Holds the build lock in another process, as a concurrent build would, until
// `releasePath` appears.
async function holdBuildLock(directory: string, releasePath: string): Promise<void> {
  const readyPath = join(directory, "holder-ready");
  const lockPath = getBuildLockPath(directory);
  await mkdir(join(directory, ".state"), { recursive: true });
  const holder = [
    "/bin/sh",
    "-c",
    'touch "$1"; while [ ! -e "$2" ]; do sleep 0.01; done',
    "hold",
    readyPath,
    releasePath,
  ];
  const command =
    process.platform === "darwin"
      ? ["/usr/bin/lockf", "-k", "-s", "-t", "0", lockPath, ...holder]
      : ["flock", "-n", lockPath, ...holder];
  holders.push(Bun.spawn(command, { stdin: "ignore", stdout: "ignore", stderr: "ignore" }));
  await waitForPath(readyPath);
}

// Records when it ran and whether it saw the lock-held marker.
function recordingCommand(outputPath: string): string[] {
  return [
    process.execPath,
    "-e",
    `require("node:fs").writeFileSync(${JSON.stringify(outputPath)}, JSON.stringify({ at: Date.now(), held: process.env.${BUILD_LOCK_HELD_ENV} }))`,
  ];
}

afterEach(async () => {
  for (const holder of holders.splice(0)) {
    holder.kill();
    await holder.exited;
  }
  for (const directory of testDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

afterAll(async () => {
  await rm(PARENT_PATH, { recursive: true, force: true });
});

describe("runUnderBuildLock", () => {
  it("runs the command at once under the lock, creating .state, and returns its exit code", async () => {
    const directory = await createDirectory();
    const outputPath = join(directory, "ran.json");
    const messages: string[] = [];

    const exitCode = await runUnderBuildLock(directory, recordingCommand(outputPath), { log: (m) => messages.push(m) });

    expect(exitCode).toBe(0);
    expect(JSON.parse(await readFile(outputPath, "utf-8")).held).toBe("1");
    expect(existsSync(getBuildLockPath(directory))).toBe(true);
    expect(messages).toEqual([]);
    expect(await runUnderBuildLock(directory, [process.execPath, "-e", "process.exit(3)"])).toBe(3);
  });

  it("waits for a concurrent build to release the lock, then runs", async () => {
    const directory = await createDirectory();
    const releasePath = join(directory, "release");
    const outputPath = join(directory, "ran.json");
    await holdBuildLock(directory, releasePath);
    const messages: string[] = [];

    const run = runUnderBuildLock(directory, recordingCommand(outputPath), { log: (m) => messages.push(m) });
    await Bun.sleep(300);
    expect(existsSync(outputPath)).toBe(false);
    const releasedAt = Date.now();
    await writeFile(releasePath, "");

    expect(await run).toBe(0);
    expect(JSON.parse(await readFile(outputPath, "utf-8")).at).toBeGreaterThanOrEqual(releasedAt);
    expect(messages).toEqual([
      `⏳ Another build of this checkout is running; waiting up to 600s for ${getBuildLockPath(directory)}...`,
    ]);
  });

  it("fails without running the command when the lock stays held past the wait", async () => {
    const directory = await createDirectory();
    const outputPath = join(directory, "ran.json");
    await holdBuildLock(directory, join(directory, "never-released"));

    await expect(
      runUnderBuildLock(directory, recordingCommand(outputPath), { waitSeconds: 1, log: () => undefined }),
    ).rejects.toThrow(`Another build held ${getBuildLockPath(directory)} for more than 1s.`);
    expect(existsSync(outputPath)).toBe(false);
  });

  it("refuses platforms without lockf or flock", async () => {
    const directory = await createDirectory();

    await expect(runUnderBuildLock(directory, ["true"], { platform: "win32" })).rejects.toThrow(
      "Builds require macOS lockf or Linux flock (platform: win32).",
    );
  });
});
