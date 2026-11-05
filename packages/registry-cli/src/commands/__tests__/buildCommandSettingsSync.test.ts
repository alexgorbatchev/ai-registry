import { factory_testRoot } from "./fixtures";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { afterAll, afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";

import { buildCommand } from "../buildCommand";
import type { IRegistryPaths } from "../../lib/getRegistryPaths";
import { getManagedEntryNames } from "../../lib/homeTargetUtils";
import { readGeneratedOutputManifest } from "../../lib/readGeneratedOutputManifest";
import { applySettingsChanges } from "../../lib/settingsSync/applySettingsChanges";
import { copyRepositoryHarnesses, loadTestShellEnvironment } from "./helpers";

const TEST_ROOT = factory_testRoot("build-settings-sync-tests");

afterAll(async () => {
  await rm(TEST_ROOT, { recursive: true, force: true });
});

describe("buildCommand settings sync", () => {
  let tempDir: string;
  let registryPaths: IRegistryPaths;

  beforeEach(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    tempDir = await mkdtemp(join(TEST_ROOT, "case-"));
    const repoRoot = join(tempDir, "repo");

    await copyRepositoryHarnesses(join(repoRoot, "harnesses"));
    await mkdir(join(repoRoot, "skills", "base-skill"), { recursive: true });
    await writeFile(join(repoRoot, "skills", "base-skill", "SKILL.md"), "---\nname: base-skill\n---\n# Base Skill\n");
    await mkdir(join(repoRoot, "commands"), { recursive: true });
    await writeFile(join(repoRoot, "commands", "base-cmd.md"), "---\ndescription: Base command\n---\n# Base Command\n");
    await mkdir(join(repoRoot, "system"), { recursive: true });
    await writeFile(join(repoRoot, "system", "system.md"), "Base prompt\n");

    registryPaths = {
      root: repoRoot,
      overlays: [],
      harnesses: join(repoRoot, "harnesses"),
      skills: join(repoRoot, "skills"),
      commands: join(repoRoot, "commands"),
      systemPrompt: join(repoRoot, "system", "system.md"),
      output: join(repoRoot, ".output"),
      temp: join(repoRoot, ".tmp"),
      state: join(repoRoot, ".state"),
    };
    spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    mock.restore();
    delete process.env.AI_REGISTRY_CODEX_TRUSTED_DIRS;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("syncs a harness-edited settings file into the registry without asking to overwrite", async () => {
    await buildCommand({ hasAutoConfirm: true, registryPaths, loadShellEnvironment: loadTestShellEnvironment });
    const livePath = join(registryPaths.output, "claude-code", "settings.json");
    const sourcePath = join(registryPaths.harnesses, "claude-code", "settings.json");
    const liveSettings = JSON.parse(await readFile(livePath, "utf-8"));
    await writeFile(livePath, `${JSON.stringify({ ...liveSettings, harnessAddedSetting: true }, null, 2)}\n`);

    // No -y and no terminal: any reported drift would cancel the build.
    await buildCommand({ hasAutoConfirm: false, registryPaths, loadShellEnvironment: loadTestShellEnvironment });

    expect(JSON.parse(await readFile(sourcePath, "utf-8")).harnessAddedSetting).toBe(true);
    expect(JSON.parse(await readFile(livePath, "utf-8")).harnessAddedSetting).toBe(true);
  });

  it("keeps the settings merge base under .state so a later build propagates harness removals", async () => {
    await buildCommand({ hasAutoConfirm: true, registryPaths, loadShellEnvironment: loadTestShellEnvironment });
    const livePath = join(registryPaths.output, "claude-code", "settings.json");
    const sourcePath = join(registryPaths.harnesses, "claude-code", "settings.json");
    const liveSettings = JSON.parse(await readFile(livePath, "utf-8"));
    await writeFile(livePath, `${JSON.stringify({ ...liveSettings, harnessAddedSetting: true }, null, 2)}\n`);
    await buildCommand({ hasAutoConfirm: true, registryPaths, loadShellEnvironment: loadTestShellEnvironment });

    const basePath = join(registryPaths.state, "settings-sync", "claude-code", "settings.json.json");
    expect(JSON.parse(await readFile(basePath, "utf-8")).harnessAddedSetting).toBe(true);
    expect(existsSync(join(registryPaths.temp, "settings-sync"))).toBe(false);

    // Only the recorded base distinguishes a harness removal from a source addition.
    await writeFile(livePath, `${JSON.stringify(liveSettings, null, 2)}\n`);
    await buildCommand({ hasAutoConfirm: true, registryPaths, loadShellEnvironment: loadTestShellEnvironment });

    expect(JSON.parse(await readFile(sourcePath, "utf-8")).harnessAddedSetting).toBeUndefined();
    expect(JSON.parse(await readFile(livePath, "utf-8")).harnessAddedSetting).toBeUndefined();
  });

  it("merges generated Codex project trust with trust Codex recorded itself, keeping both out of the source", async () => {
    const projectsDir = join(tempDir, "projects");
    await mkdir(join(projectsDir, "listed", ".git"), { recursive: true });
    await mkdir(join(projectsDir, "declined", ".git"), { recursive: true });
    process.env.AI_REGISTRY_CODEX_TRUSTED_DIRS = projectsDir;
    const sourcePath = join(registryPaths.harnesses, "codex", "config.toml");
    const sourceBefore = await readFile(sourcePath, "utf-8");
    await buildCommand({ hasAutoConfirm: true, registryPaths, loadShellEnvironment: loadTestShellEnvironment });

    const livePath = join(registryPaths.output, "codex", "config.toml");
    // Codex declines one listed project and trusts one outside the listed folders.
    await writeFile(
      livePath,
      applySettingsChanges(
        await readFile(livePath, "utf-8"),
        [
          { keyPath: ["projects", join(projectsDir, "declined"), "trust_level"], value: "untrusted" },
          { keyPath: ["projects", "/elsewhere/codex-trusted", "trust_level"], value: "trusted" },
        ],
        livePath,
      ),
    );
    await buildCommand({ hasAutoConfirm: true, registryPaths, loadShellEnvironment: loadTestShellEnvironment });

    const live = Bun.TOML.parse(await readFile(livePath, "utf-8"));
    expect(Reflect.get(live, "projects")).toEqual({
      [join(projectsDir, "declined")]: { trust_level: "untrusted" },
      [join(projectsDir, "listed")]: { trust_level: "trusted" },
      "/elsewhere/codex-trusted": { trust_level: "trusted" },
    });
    expect(await readFile(sourcePath, "utf-8")).toBe(sourceBefore);
  });

  it("records synced settings files in the manifest so bootstrap links them into harness homes", async () => {
    await buildCommand({ hasAutoConfirm: true, registryPaths, loadShellEnvironment: loadTestShellEnvironment });

    const manifest = await readGeneratedOutputManifest(registryPaths.output);
    assert(manifest !== null);
    expect(manifest.syncedFilePaths).toEqual([
      "claude-code/settings.json",
      "codex/config.toml",
      "opencode/opencode.jsonc",
      "pi/settings.json",
    ]);
    expect(getManagedEntryNames(manifest, registryPaths.output, join(registryPaths.output, "codex"))).toEqual([
      "AGENTS.md",
      "config.toml",
      "rules",
      "skills",
    ]);
  });
});
