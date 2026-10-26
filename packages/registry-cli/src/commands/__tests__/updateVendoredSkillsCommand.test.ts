import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";

import { updateVendoredSkillsCommand } from "../updateVendoredSkillsCommand";
import type { IRunCommandSpawnOptions, IRunCommandSpawnedProcess } from "../../lib/runCommand";

const TEST_ROOT = join(import.meta.dir, "..", "..", "..", ".tmp", "update-vendored-skills-tests");

describe("updateVendoredSkillsCommand", () => {
  let root: string;
  let spawnedCommands: string[][];
  let relocations: Array<[string, string, string | undefined]>;
  let logLines: string[];

  function spawn(options: IRunCommandSpawnOptions): IRunCommandSpawnedProcess {
    spawnedCommands.push(options.cmd);
    return { exited: Promise.resolve(0) };
  }

  async function relocate(skillRoot: string, skillName: string, source?: string): Promise<void> {
    relocations.push([skillRoot, skillName, source]);
  }

  function run(requestedSkillNames: string[] = []): Promise<void> {
    return updateVendoredSkillsCommand({ argv: ["bun", "update-vendored-skills.ts", ...requestedSkillNames], root, relocate, spawn });
  }

  async function writeLock(content: unknown): Promise<void> {
    await writeFile(join(root, "skills-lock.json"), JSON.stringify(content), "utf-8");
  }

  beforeEach(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    root = await mkdtemp(join(TEST_ROOT, "case-"));
    spawnedCommands = [];
    relocations = [];
    logLines = [];
    spyOn(console, "log").mockImplementation((...values: unknown[]) => {
      logLines.push(values.join(" "));
    });
  });

  afterEach(async () => {
    mock.restore();
    await rm(root, { recursive: true, force: true });
  });

  it("reinstalls every locked skill, pinning recorded refs", async () => {
    await writeLock({
      version: 1,
      skills: {
        archify: { source: "tt-a1i/archify", sourceType: "github" },
        pinned: { source: "owner/pinned", ref: "v2" },
      },
    });

    await run();

    expect(spawnedCommands).toEqual([
      ["npx", "skills", "add", "tt-a1i/archify", "--skill", "archify", "-a", "openclaw", "--copy", "-y"],
      ["npx", "skills", "add", "owner/pinned#v2", "--skill", "pinned", "-a", "openclaw", "--copy", "-y"],
    ]);
    expect(relocations).toEqual([
      [root, "archify", "tt-a1i/archify"],
      [root, "pinned", "owner/pinned"],
    ]);
  });

  it("updates only the requested skills", async () => {
    await writeLock({ skills: { one: { source: "owner/one" }, two: { source: "owner/two" } } });

    await run(["two"]);

    expect(relocations).toEqual([[root, "two", "owner/two"]]);
  });

  it("rejects requested skills that the lock does not record", async () => {
    await writeLock({ skills: { one: { source: "owner/one" } } });

    await expect(run(["missing", "other"])).rejects.toThrow("No vendored skills found matching: missing, other");
  });

  it("reports an empty lock without installing anything", async () => {
    await writeLock({ version: 1, skills: {} });

    await run();

    expect(spawnedCommands).toEqual([]);
    expect(logLines).toEqual(["No vendored external skills recorded in skills-lock.json."]);
  });

  it.each([
    [{ version: 1 }],
    [{ skills: { broken: { ref: "v1" } } }],
    [[]],
  ])("rejects an invalid lock %p", async (content) => {
    await writeLock(content);

    await expect(run()).rejects.toThrow(`Invalid vendored skill lock: ${join(root, "skills-lock.json")}`);
  });
});
