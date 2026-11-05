import { factory_testRoot } from "./fixtures";
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { runLoggedScheduledUpdate } from "../runLoggedScheduledUpdate";
import { readTimestampedLog } from "./helpers";

const PARENT_PATH = factory_testRoot("scheduled-logged-worker-tests");
const testDirectories: string[] = [];

afterEach(async () => {
  for (const directory of testDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

afterAll(async () => {
  await rm(PARENT_PATH, { recursive: true, force: true });
});

describe("runLoggedScheduledUpdate", () => {
  it.each([0, 1, 75])("prunes, logs both output streams and returns worker exit %d", async (exitCode) => {
    await mkdir(PARENT_PATH, { recursive: true });
    const directory = await mkdtemp(join(PARENT_PATH, "checkout "));
    testDirectories.push(directory);
    await mkdir(join(directory, ".state"));
    const logPath = join(directory, ".state/scheduled-update.log");
    await Bun.write(logPath, "[2000-01-01 00:00] expired\n");
    expect(
      await runLoggedScheduledUpdate(directory, [
        process.execPath,
        "-e",
        ['console.log("stdout"); console.error("stderr");', `process.exit(${exitCode});`].join("\n"),
      ]),
    ).toBe(exitCode);
    expect(await readTimestampedLog(logPath)).toBe("stdout\nstderr\n");
  });
});
