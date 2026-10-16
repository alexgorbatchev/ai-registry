import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { runLockedScheduledUpdate } from "../runLockedScheduledUpdate";
import { readTimestampedLog } from "./helpers";

const testDirectories: string[] = [];

async function createDirectory(): Promise<string> {
  const parentPath = resolve(".tmp/scheduled-lock-tests");
  await mkdir(parentPath, { recursive: true });
  const directory = await mkdtemp(join(parentPath, "checkout with 'quotes' "));
  testDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  for (const directory of testDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("runLockedScheduledUpdate", () => {
  it("creates its runtime directory and appends stdout and stderr across runs", async () => {
    const directory = await createDirectory();
    const command = [process.execPath, "-e", 'console.log("stdout"); console.error("stderr");'];
    expect(await runLockedScheduledUpdate(directory, command)).toBe("completed");
    expect(await runLockedScheduledUpdate(directory, command)).toBe("completed");
    expect(await readTimestampedLog(join(directory, ".tmp/scheduled-update.log"))).toBe(
      "stdout\nstderr\nstdout\nstderr\n",
    );
  });

  it("skips overlapping runs and releases the lock when the first run finishes", async () => {
    const directory = await createDirectory();
    const readyPath = join(directory, ".tmp/ready");
    const releasePath = join(directory, ".tmp/release");
    const first = runLockedScheduledUpdate(directory, [process.execPath, "-e", [
      'await Bun.write(".tmp/ready", "ready");',
      'while (!(await Bun.file(".tmp/release").exists())) await Bun.sleep(10);',
      'console.log("first");',
    ].join("\n")]);
    try {
      const deadline = Date.now() + 3000;
      while (!(await Bun.file(readyPath).exists())) {
        expect(Date.now()).toBeLessThan(deadline);
        await Bun.sleep(10);
      }
      expect(await runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("overlap");']))
        .toBe("busy");
    } finally {
      await Bun.write(releasePath, "release");
      await first;
    }
    expect(await runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("after");']))
      .toBe("completed");
    expect(await readTimestampedLog(join(directory, ".tmp/scheduled-update.log"))).toBe("first\nafter\n");
  });

  it("reports worker failures with the log location and releases the lock", async () => {
    const directory = await createDirectory();
    await expect(runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.error("failed"); process.exit(1);']))
      .rejects.toThrow(`Scheduled update failed (exit code 1). See ${join(directory, ".tmp/scheduled-update.log")}`);
    expect(await runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("retry");']))
      .toBe("completed");
    expect(await readTimestampedLog(join(directory, ".tmp/scheduled-update.log"))).toBe("failed\nretry\n");
  });

  it("reports unsupported platforms before starting the worker", async () => {
    const directory = await createDirectory();
    await expect(runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("unexpected");'], "win32"))
      .rejects.toThrow("Scheduled updates require macOS lockf or Linux flock (platform: win32).");
    expect(await Bun.file(join(directory, ".tmp/scheduled-update.log")).exists()).toBe(false);
  });
});
