import { describe, expect, it } from "bun:test";

import { runCommand } from "../runCommand";

type IRecordedSpawnOptions = {
  cmd: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  stdin: "inherit";
  stdout: "inherit";
  stderr: "inherit";
};

describe("runCommand", () => {
  it("spawns subprocesses with inherited stdio", async () => {
    const recordedSpawnOptions: IRecordedSpawnOptions[] = [];

    await runCommand({
      cmd: ["bun", "run", "build"],
      cwd: "/repo",
      description: "build generated outputs",
      spawn: (options) => {
        recordedSpawnOptions.push(options);
        return { exited: Promise.resolve(0) };
      },
    });

    expect(recordedSpawnOptions).toEqual([
      {
        cmd: ["bun", "run", "build"],
        cwd: "/repo",
        env: undefined,
        stderr: "inherit",
        stdin: "inherit",
        stdout: "inherit",
      },
    ]);
  });

  it("throws a concise failure message with a hint", async () => {
    const result = runCommand({
      cmd: ["bun", "run", "build"],
      cwd: "/repo",
      description: "build generated outputs",
      failureHint: "If generated outputs drifted, rerun `bun bootstrap -- -y`.",
      spawn: () => ({ exited: Promise.resolve(1) }),
    });

    await expect(result).rejects.toMatchObject({
      message: "Failed to build generated outputs (exit code 1).\nIf generated outputs drifted, rerun `bun bootstrap -- -y`.",
    });
  });
});
