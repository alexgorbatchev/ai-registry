import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { runLockedScheduledUpdate } from "../runLockedScheduledUpdate";
import { REPOSITORY_ROOT, readTimestampedLog } from "./helpers";

const PARENT_PATH = resolve(REPOSITORY_ROOT, ".tmp/scheduled-lock-tests");
const testDirectories: string[] = [];

async function createDirectory(): Promise<string> {
  await mkdir(PARENT_PATH, { recursive: true });
  const directory = await mkdtemp(join(PARENT_PATH, "checkout with 'quotes' "));
  testDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  for (const directory of testDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

afterAll(async () => {
  await rm(PARENT_PATH, { recursive: true, force: true });
});

function holdNativeLock(lockPath: string, readyPath: string, releasePath: string): Bun.Subprocess {
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
  return Bun.spawn(command, { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
}

describe("runLockedScheduledUpdate", () => {
  it("creates its runtime directory and appends stdout and stderr across runs", async () => {
    const directory = await createDirectory();
    const command = [process.execPath, "-e", 'console.log("stdout"); console.error("stderr");'];
    expect(await runLockedScheduledUpdate(directory, command)).toBe("completed");
    expect(await runLockedScheduledUpdate(directory, command)).toBe("completed");
    expect(await readTimestampedLog(join(directory, ".state/scheduled-update.log"))).toBe(
      "stdout\nstderr\nstdout\nstderr\n",
    );
  });

  it("skips the run while another process holds the lock under .state", async () => {
    const directory = await createDirectory();
    await mkdir(join(directory, ".state"));
    const readyPath = join(directory, "holder-ready");
    const releasePath = join(directory, "holder-release");
    const holder = holdNativeLock(join(directory, ".state/scheduled-update.lock"), readyPath, releasePath);
    try {
      const deadline = Date.now() + 3000;
      while (!(await Bun.file(readyPath).exists())) {
        expect(Date.now()).toBeLessThan(deadline);
        await Bun.sleep(10);
      }
      expect(await runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("overlap");'])).toBe(
        "busy",
      );
      expect(await Bun.file(join(directory, ".state/scheduled-update.log")).exists()).toBe(false);
    } finally {
      await Bun.write(releasePath, "release");
      const exited = await Promise.race([holder.exited, Bun.sleep(3000).then(() => null)]);
      if (exited === null) {
        holder.kill("SIGKILL");
        await holder.exited;
      }
    }
    expect(await runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("after");'])).toBe(
      "completed",
    );
    expect(await readTimestampedLog(join(directory, ".state/scheduled-update.log"))).toBe("after\n");
  });

  it("prunes expired logs before starting the worker and preserves recent output", async () => {
    const directory = await createDirectory();
    await mkdir(join(directory, ".state"));
    const logPath = join(directory, ".state/scheduled-update.log");
    await Bun.write(logPath, "[2000-01-01 00:00] expired\n");
    const command = [
      process.execPath,
      "-e",
      ['console.log(await Bun.file(".state/scheduled-update.log").text() === "" ? "pruned" : "stale");'].join("\n"),
    ];
    expect(await runLockedScheduledUpdate(directory, command)).toBe("completed");
    expect(await runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("next");'])).toBe(
      "completed",
    );
    expect(await readTimestampedLog(logPath)).toBe("pruned\nnext\n");
  });

  it("skips overlapping runs and releases the lock when the first run finishes", async () => {
    const directory = await createDirectory();
    const readyPath = join(directory, ".tmp/ready");
    const releasePath = join(directory, ".tmp/release");
    const first = runLockedScheduledUpdate(directory, [
      process.execPath,
      "-e",
      [
        'await Bun.write(".tmp/ready", "ready");',
        'while (!(await Bun.file(".tmp/release").exists())) await Bun.sleep(10);',
        'console.log("first");',
      ].join("\n"),
    ]);
    try {
      const deadline = Date.now() + 3000;
      while (!(await Bun.file(readyPath).exists())) {
        expect(Date.now()).toBeLessThan(deadline);
        await Bun.sleep(10);
      }
      const logPath = join(directory, ".state/scheduled-update.log");
      await Bun.write(logPath, "[2000-01-01 00:00] active run\n");
      expect(await runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("overlap");'])).toBe(
        "busy",
      );
      expect(await Bun.file(logPath).text()).toBe("[2000-01-01 00:00] active run\n");
    } finally {
      await Bun.write(releasePath, "release");
      await first;
    }
    expect(await runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("after");'])).toBe(
      "completed",
    );
    expect(await readTimestampedLog(join(directory, ".state/scheduled-update.log"))).toBe("first\nafter\n");
  });

  it("reports worker failures with the log location and releases the lock", async () => {
    const directory = await createDirectory();
    await expect(
      runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.error("failed"); process.exit(1);']),
    ).rejects.toThrow(`Scheduled update failed (exit code 1). See ${join(directory, ".state/scheduled-update.log")}`);
    expect(await runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("retry");'])).toBe(
      "completed",
    );
    expect(await readTimestampedLog(join(directory, ".state/scheduled-update.log"))).toBe("failed\nretry\n");
  });

  it("keeps the worker and logging locked if the launcher is terminated", async () => {
    const directory = await createDirectory();
    const readyPath = join(directory, ".tmp/ready");
    const releasePath = join(directory, ".tmp/release");
    const workerCommand = [
      process.execPath,
      "-e",
      [
        'await Bun.write(".tmp/ready", "ready");',
        'while (!(await Bun.file(".tmp/release").exists())) await Bun.sleep(10);',
        'console.log("survived");',
      ].join("\n"),
    ];
    const sourcePath = resolve(REPOSITORY_ROOT, "packages/registry-cli/src/lib/runLockedScheduledUpdate.ts");
    const launcher = Bun.spawn(
      [
        process.execPath,
        "-e",
        [
          `import { runLockedScheduledUpdate } from ${JSON.stringify(sourcePath)};`,
          `await runLockedScheduledUpdate(${JSON.stringify(directory)}, ${JSON.stringify(workerCommand)});`,
        ].join("\n"),
      ],
      { stdout: "ignore", stderr: "ignore" },
    );
    try {
      const deadline = Date.now() + 3000;
      while (!(await Bun.file(readyPath).exists())) {
        expect(Date.now()).toBeLessThan(deadline);
        await Bun.sleep(10);
      }
      launcher.kill();
      await launcher.exited;
      expect(await runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("overlap");'])).toBe(
        "busy",
      );
    } finally {
      launcher.kill();
      await launcher.exited;
      await Bun.write(releasePath, "release");
      const deadline = Date.now() + 3000;
      let result = await runLockedScheduledUpdate(directory, [process.execPath, "-e", "process.exit(0)"]);
      while (result === "busy") {
        expect(Date.now()).toBeLessThan(deadline);
        await Bun.sleep(10);
        result = await runLockedScheduledUpdate(directory, [process.execPath, "-e", "process.exit(0)"]);
      }
    }
    expect(await readTimestampedLog(join(directory, ".state/scheduled-update.log"))).toBe("survived\n");
  });

  it("releases the lock and skips the worker when pruning fails", async () => {
    const directory = await createDirectory();
    const logPath = join(directory, ".state/scheduled-update.log");
    await mkdir(`${logPath}.pruning`, { recursive: true });
    await Bun.write(logPath, "[2000-01-01 00:00] original\n");
    await expect(
      runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("unexpected");']),
    ).rejects.toThrow();
    expect(await Bun.file(logPath).text()).toBe("[2000-01-01 00:00] original\n");
    await rm(`${logPath}.pruning`, { recursive: true });
    expect(await runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("retry");'])).toBe(
      "completed",
    );
    expect(await readTimestampedLog(logPath)).toBe("retry\n");
  });

  it("reports worker exit 75 as a failure rather than lock contention", async () => {
    const directory = await createDirectory();
    await expect(runLockedScheduledUpdate(directory, [process.execPath, "-e", "process.exit(75)"])).rejects.toThrow(
      `Scheduled update failed (exit code 1). See ${join(directory, ".state/scheduled-update.log")}`,
    );
  });

  it("reports unsupported platforms before starting the worker", async () => {
    const directory = await createDirectory();
    await expect(
      runLockedScheduledUpdate(directory, [process.execPath, "-e", 'console.log("unexpected");'], "win32"),
    ).rejects.toThrow("Scheduled updates require macOS lockf or Linux flock (platform: win32).");
    expect(await Bun.file(join(directory, ".state/scheduled-update.log")).exists()).toBe(false);
  });
});
