import { describe, expect, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { factory_testDirectory } from "./fixtures";

const runner = resolve(import.meta.dir, "../run-tests.sh");
const repositoryRoot = resolve(import.meta.dir, "../../../../..");

describe.each([
  ["packages/template-resolver", "src/__tests__"],
  ["skills/user/disk-cleanup", "scripts/__tests__"],
  ["harnesses/claude-code/hooks", "__tests__"],
])("%s fixture cleanup", (packagePath, testPath) => {
  it.each([
    ["success", "expect(true).toBe(true);", 0],
    ["assertion failure", "expect(true).toBe(false);", 1],
    ["timeout", "await Bun.sleep(60000);", 1],
  ])("removes fixture and preload roots after %s", async (_name, body, status) => {
    const parent = factory_testDirectory("package-lifecycle");
    const source = join(parent, "lifecycle.test.ts");
    const fixtures = join(repositoryRoot, packagePath, testPath, "fixtures.ts");
    await Bun.write(
      source,
      `import { test, expect } from "bun:test";
import { factory_testDirectory } from ${JSON.stringify(fixtures)};
test("owned fixture", async () => {
  const root = factory_testDirectory("fixture");
  await Bun.write(root + "/artifact", "temporary");
  ${body}
});`,
    );
    const result = Bun.spawnSync([process.execPath, "test", source, "--timeout=20"], {
      cwd: join(repositoryRoot, packagePath),
      env: { ...process.env, REGISTRY_TEST_TMPDIR: parent },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.exitCode).toBe(status);
    expect(await readdir(parent)).toEqual(["lifecycle.test.ts"]);
  });
});

describe("test command cleanup", () => {
  it.each([0, 7, 124])("removes scratch and preserves command status %d", async (status) => {
    const parent = factory_testDirectory("runner-status");
    await Bun.write(join(parent, "existing"), "preserved");
    const result = Bun.spawnSync(
      ["bash", runner, "bash", "-c", 'touch "$TMPDIR/artifact"; exit "$1"', "test", String(status)],
      { env: { ...process.env, REGISTRY_TEST_TMPDIR: parent }, stdout: "pipe", stderr: "pipe" },
    );

    expect(result.exitCode).toBe(status);
    expect(result.stderr.toString()).toBe("");
    expect(await readdir(parent)).toEqual(["existing"]);
    expect(await Bun.file(join(parent, "existing")).text()).toBe("preserved");
  });

  it.each([
    ["assertion", 'expect("actual").toBe("expected");', 1],
    ["timeout", "await Bun.sleep(60000);", 1],
    ["abrupt exit", "process.exit(9);", 9],
  ])("cleans up a Bun test ending with %s", async (_name, body, status) => {
    const parent = factory_testDirectory("runner-failure");
    const source = join(parent, "failure.test.ts");
    await Bun.write(
      source,
      `import { test, expect } from "bun:test";
test("fixture", async () => {
  await Bun.write(process.env.TMPDIR + "/artifact", "temporary");
  ${body}
});`,
    );
    const result = Bun.spawnSync(["bash", runner, process.execPath, "test", source, "--timeout=20"], {
      env: { ...process.env, REGISTRY_TEST_TMPDIR: parent },
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(status);
    expect(await readdir(parent)).toEqual(["failure.test.ts"]);
  });

  it.each([
    ["SIGTERM", 143],
    ["SIGINT", 130],
    ["SIGHUP", 129],
  ] as const)("cleans up after %s", async (signal, status) => {
    const parent = factory_testDirectory("runner-signal");
    const child = Bun.spawn(
      [
        "bash",
        runner,
        "bash",
        "-c",
        'trap "exit 0" TERM; touch "$TMPDIR/artifact"; printf ready; while :; do sleep 0.1; done',
      ],
      { env: { ...process.env, REGISTRY_TEST_TMPDIR: parent }, stdout: "pipe", stderr: "pipe" },
    );
    try {
      const ready = await child.stdout.getReader().read();
      expect(new TextDecoder().decode(ready.value)).toBe("ready");
      child.kill(signal);
      expect(await child.exited).toBe(status);
      expect(await readdir(parent)).toEqual([]);
    } finally {
      child.kill("SIGTERM");
      await child.exited;
    }
  });

  it("isolates concurrent commands sharing a scratch parent", async () => {
    const parent = factory_testDirectory("runner-concurrent");
    const children = Array.from({ length: 2 }, () =>
      Bun.spawn(["bash", runner, "bash", "-c", 'printf "%s" "$TMPDIR"; touch "$TMPDIR/artifact"; sleep 0.1'], {
        env: { ...process.env, REGISTRY_TEST_TMPDIR: parent },
        stdout: "pipe",
        stderr: "pipe",
      }),
    );
    try {
      const directories = await Promise.all(children.map((child) => new Response(child.stdout).text()));
      expect(new Set(directories).size).toBe(2);
      expect(await Promise.all(children.map((child) => child.exited))).toEqual([0, 0]);
      expect(await readdir(parent)).toEqual([]);
    } finally {
      for (const child of children) child.kill("SIGTERM");
      await Promise.all(children.map((child) => child.exited));
    }
  });
});
