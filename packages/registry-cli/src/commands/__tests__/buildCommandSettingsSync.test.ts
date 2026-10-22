import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { basename, join } from "path";

import { buildCommand } from "../buildCommand";
import type { IRegistryPaths } from "../../lib/getRegistryPaths";

const TEST_ROOT = join(import.meta.dir, "..", "..", "..", "..", "..", ".tmp", "build-settings-sync-tests");
const EXCLUDED_HARNESS_DIR_NAMES = new Set([".tmp", "docs"]);

describe("buildCommand settings sync", () => {
  let tempDir: string;
  let registryPaths: IRegistryPaths;

  beforeEach(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    tempDir = await mkdtemp(join(TEST_ROOT, "case-"));
    const repoRoot = join(tempDir, "repo");

    // A private copy of the real harnesses, because the build writes harness edits back into them.
    await cp(join(process.cwd(), "harnesses"), join(repoRoot, "harnesses"), {
      recursive: true,
      filter: (sourcePath) => !EXCLUDED_HARNESS_DIR_NAMES.has(basename(sourcePath)),
    });
    await mkdir(join(repoRoot, "skills", "base-skill"), { recursive: true });
    await writeFile(join(repoRoot, "skills", "base-skill", "SKILL.md"), "---\nname: base-skill\n---\n# Base Skill\n");
    await mkdir(join(repoRoot, "commands"), { recursive: true });
    await writeFile(join(repoRoot, "commands", "base-cmd.md"), "---\ndescription: Base command\n---\n# Base Command\n");
    await mkdir(join(repoRoot, "profiles", "default"), { recursive: true });
    await writeFile(
      join(repoRoot, "profiles", "default", "profile.yaml"),
      "description: default profile\nskills:\n  - '*'\ncommands:\n  - '*'\nsystem_prompt: 'Base prompt'\n",
    );

    registryPaths = {
      root: repoRoot,
      overlay: null,
      harnesses: join(repoRoot, "harnesses"),
      skills: join(repoRoot, "skills"),
      commands: join(repoRoot, "commands"),
      profiles: join(repoRoot, "profiles"),
      output: join(repoRoot, ".output"),
      temp: join(repoRoot, ".tmp"),
    };
    spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    mock.restore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("syncs a harness-edited settings file into the registry without asking to overwrite", async () => {
    await buildCommand({ hasAutoConfirm: true, registryPaths });
    const livePath = join(registryPaths.output, "claude-code", "default", "settings.json");
    const sourcePath = join(registryPaths.harnesses, "claude-code", "settings.json");
    const liveSettings = JSON.parse(await readFile(livePath, "utf-8"));
    await writeFile(livePath, `${JSON.stringify({ ...liveSettings, harnessAddedSetting: true }, null, 2)}\n`);

    // No -y and no terminal: any reported drift would cancel the build.
    await buildCommand({ hasAutoConfirm: false, registryPaths });

    expect(JSON.parse(await readFile(sourcePath, "utf-8")).harnessAddedSetting).toBe(true);
    expect(JSON.parse(await readFile(livePath, "utf-8")).harnessAddedSetting).toBe(true);
  });
});
