import { afterAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";

import { scanPushedCommits } from "../scanPushedCommits";
import type { GitleaksResult } from "../runGitleaks";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "scan-pushed-commits-tests");
const HOOK_ENTRYPOINT = join(import.meta.dir, "..", "..", "bin", "scan-pushed-commits.ts");
const createdDirectories: string[] = [];
const NULL_OBJECT_ID = "0".repeat(40);
// Assembled at runtime so this test file itself never contains a detectable key.
const FAKE_AWS_ACCESS_KEY_ID = ["AKIA", "IOSFODNN7EXAMPLQ"].join("");

function createRecordingScan(result: GitleaksResult): { ranges: string[]; scan: (range: string) => Promise<GitleaksResult> } {
  const ranges: string[] = [];
  return {
    ranges,
    scan: async (range) => {
      ranges.push(range);
      return result;
    },
  };
}

async function createRepositoryWithRemote(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const rootDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(rootDir);
  const repositoryDir = join(rootDir, "repo");
  await $`git init --quiet --bare --initial-branch=main ${join(rootDir, "remote.git")}`.quiet();
  await $`git init --quiet --initial-branch=main ${repositoryDir}`.quiet();
  await $`git config user.name Tester && git config user.email tester@example.com`.cwd(repositoryDir).quiet();
  await $`git remote add origin ${join(rootDir, "remote.git")}`.cwd(repositoryDir).quiet();
  await writeFile(join(repositoryDir, "readme.md"), "# Repo\n");
  await $`git add . && git commit --quiet -m initial && git push --quiet origin main`.cwd(repositoryDir).quiet();
  return repositoryDir;
}

async function runHook(repositoryDir: string, input: string): Promise<{ exitCode: number; stderr: string }> {
  const subprocess = Bun.spawn(["bun", HOOK_ENTRYPOINT, "origin", "unused-url"], {
    cwd: repositoryDir,
    stdin: new Blob([input]),
    stdout: "ignore",
    stderr: "pipe",
  });
  const [exitCode, stderr] = await Promise.all([subprocess.exited, new Response(subprocess.stderr).text()]);
  return { exitCode, stderr };
}

afterAll(async () => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

describe("scanPushedCommits", () => {
  it("scans new history on updated branches and unpublished history on new branches, skipping deletions", async () => {
    const recording = createRecordingScan("clean");

    await scanPushedCommits({
      input: [
        `refs/heads/main bbb refs/heads/main aaa`,
        `refs/heads/feature ccc refs/heads/feature ${NULL_OBJECT_ID}`,
        `(delete) ${NULL_OBJECT_ID} refs/heads/old ddd`,
        "",
      ].join("\n"),
      remoteName: "origin",
      scanCommitRange: recording.scan,
    });

    expect(recording.ranges).toEqual(["aaa..bbb", "ccc --not --remotes=origin"]);
  });

  it("blocks the push when gitleaks finds secrets", async () => {
    const recording = createRecordingScan("leaks");

    await expect(
      scanPushedCommits({ input: "refs/heads/main bbb refs/heads/main aaa\n", remoteName: "origin", scanCommitRange: recording.scan }),
    ).rejects.toThrow(
      "Push blocked: gitleaks found secrets in aaa..bbb. Remove them from the outgoing commits, or record a reviewed false positive in .gitleaksignore, before pushing.",
    );
  });

  it("lets the pre-push entrypoint pass clean commits and block commits that add a secret", async () => {
    const repositoryDir = await createRepositoryWithRemote();
    const remoteHead = (await $`git rev-parse HEAD`.cwd(repositoryDir).text()).trim();
    await writeFile(join(repositoryDir, "notes.md"), "Nothing secret.\n");
    await $`git add . && git commit --quiet -m clean`.cwd(repositoryDir).quiet();
    const cleanHead = (await $`git rev-parse HEAD`.cwd(repositoryDir).text()).trim();

    const cleanPush = await runHook(repositoryDir, `refs/heads/main ${cleanHead} refs/heads/main ${remoteHead}\n`);

    await writeFile(join(repositoryDir, "settings.json"), `{ "awsKeyId": "${FAKE_AWS_ACCESS_KEY_ID}" }\n`);
    await $`git add . && git commit --quiet -m leak`.cwd(repositoryDir).quiet();
    const leakHead = (await $`git rev-parse HEAD`.cwd(repositoryDir).text()).trim();

    const leakingPush = await runHook(repositoryDir, `refs/heads/feature ${leakHead} refs/heads/feature ${NULL_OBJECT_ID}\n`);

    expect(cleanPush).toEqual({ exitCode: 0, stderr: "" });
    expect(leakingPush.exitCode).toBe(1);
    expect(leakingPush.stderr.trimEnd().split("\n").at(-1)).toBe(
      `Push blocked: gitleaks found secrets in ${leakHead} --not --remotes=origin. Remove them from the outgoing commits, or record a reviewed false positive in .gitleaksignore, before pushing.`,
    );
  });
});
