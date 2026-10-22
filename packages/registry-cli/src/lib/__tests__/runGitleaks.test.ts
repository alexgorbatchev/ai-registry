import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";

import { runGitleaks } from "../runGitleaks";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "run-gitleaks-tests");
const createdDirectories: string[] = [];
const originalPath = process.env.PATH;
// Assembled at runtime so this test file itself never contains a detectable key.
const FAKE_AWS_ACCESS_KEY_ID = ["AKIA", "IOSFODNN7EXAMPLQ"].join("");

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const testDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(testDir);
  return testDir;
}

afterEach(() => {
  process.env.PATH = originalPath;
});

afterAll(async () => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

describe("runGitleaks", () => {
  it("reports clean files and files with secrets", async () => {
    const testDir = await createTestDirectory();
    await writeFile(join(testDir, "clean.json"), '{ "model": "opus" }\n');
    await writeFile(join(testDir, "leak.json"), `{ "awsKeyId": "${FAKE_AWS_ACCESS_KEY_ID}" }\n`);

    expect(await runGitleaks(["dir", join(testDir, "clean.json")], testDir)).toBe("clean");
    expect(await runGitleaks(["dir", join(testDir, "leak.json")], testDir)).toBe("leaks");
  });

  it("throws when the scan itself fails instead of reporting it clean", async () => {
    const testDir = await createTestDirectory();

    await expect(runGitleaks(["dir", "--unknown-flag"], testDir)).rejects.toThrow(
      "gitleaks dir --unknown-flag failed with exit code 126.",
    );
  });

  it("explains that gitleaks is required when it cannot be started", async () => {
    const testDir = await createTestDirectory();
    process.env.PATH = testDir;

    await expect(runGitleaks(["dir", testDir], testDir)).rejects.toThrow(
      "gitleaks is required to scan for secrets but could not be started:",
    );
  });
});
