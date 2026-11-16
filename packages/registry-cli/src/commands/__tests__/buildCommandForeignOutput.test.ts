import { factory_testRoot } from "./fixtures";
import { $ } from "bun";
import { afterAll, afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { buildCommand } from "../buildCommand";
import type { IRegistryPaths } from "../../lib/getRegistryPaths";
import { copyRepositoryHarnesses, loadTestShellEnvironment } from "./helpers";

const TEST_ROOT = factory_testRoot("build-foreign-output-tests");

afterAll(async () => {
  await rm(TEST_ROOT, { recursive: true, force: true });
});

function getRegistryPaths(root: string): IRegistryPaths {
  return {
    root,
    overlays: [],
    harnesses: join(root, "harnesses"),
    skills: join(root, "skills"),
    commands: join(root, "commands"),
    systemPrompt: join(root, "system", "system.md"),
    output: join(root, ".output"),
    temp: join(root, ".tmp"),
    state: join(root, ".state"),
  };
}

async function build(root: string): Promise<void> {
  await buildCommand({
    hasAutoConfirm: true,
    registryPaths: getRegistryPaths(root),
    loadShellEnvironment: loadTestShellEnvironment,
  });
}

async function commitCount(root: string): Promise<number> {
  return Number((await $`git rev-list --count HEAD`.cwd(root).quiet().text()).trim());
}

async function status(root: string): Promise<string> {
  return (await $`git status --porcelain`.cwd(root).quiet().text()).trim();
}

// Every file under `dir` whose text mentions `needle`, relative to `dir`.
async function filesMentioning(dir: string, needle: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const matches: string[] = [];
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    if ((await readFile(path, "utf-8")).includes(needle)) matches.push(path.slice(dir.length + 1));
  }
  return matches.sort();
}

describe("buildCommand with an output rendered for another checkout", () => {
  let primary: string;
  let worktree: string;

  beforeEach(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    const caseDir = await mkdtemp(join(TEST_ROOT, "case-"));
    primary = join(caseDir, "primary");
    worktree = join(caseDir, "worktree");

    await copyRepositoryHarnesses(join(primary, "harnesses"));
    await mkdir(join(primary, "skills", "base-skill"), { recursive: true });
    await writeFile(join(primary, "skills", "base-skill", "SKILL.md"), "---\nname: base-skill\n---\n# Base Skill\n");
    await mkdir(join(primary, "commands"), { recursive: true });
    await writeFile(join(primary, "commands", "base-cmd.md"), "---\ndescription: Base command\n---\n# Base Command\n");
    await mkdir(join(primary, "system"), { recursive: true });
    await writeFile(join(primary, "system", "system.md"), "Base prompt\n");
    await writeFile(join(primary, ".gitignore"), ".output/\n.state/\n.tmp/\n");
    await $`git init --quiet --initial-branch=main`.cwd(primary).quiet();
    await $`git config user.name Test`.cwd(primary).quiet();
    await $`git config user.email test@example.invalid`.cwd(primary).quiet();
    await $`git config commit.gpgsign false`.cwd(primary).quiet();
    await $`git add -A`.cwd(primary).quiet();
    await $`git commit --quiet -m initial`.cwd(primary).quiet();

    spyOn(console, "log").mockImplementation(() => {});
    spyOn(console, "warn").mockImplementation(() => {});
    await build(primary);
    await $`git worktree add --quiet -b run ${worktree}`.cwd(primary).quiet();
  });

  afterEach(() => {
    mock.restore();
  });

  // What a worktree seeding tool does: copy the primary checkout's ignored files into it.
  async function seedWorktree(options: { withState: boolean }): Promise<void> {
    await cp(join(primary, ".output"), join(worktree, ".output"), { recursive: true });
    if (options.withState) await cp(join(primary, ".state"), join(worktree, ".state"), { recursive: true });
  }

  it.each([false, true])(
    "re-seeds a copied output instead of writing the primary's paths back (state copied: %p)",
    async (withState) => {
      await seedWorktree({ withState });
      const seededLive = await readFile(join(worktree, ".output", "opencode", "opencode.jsonc"), "utf-8");
      expect(seededLive).toContain(`${primary}/`);
      const primaryCommits = await commitCount(primary);
      const worktreeCommits = await commitCount(worktree);

      await build(worktree);

      expect(await commitCount(worktree)).toBe(worktreeCommits);
      expect(await status(worktree)).toBe("");
      expect(await filesMentioning(join(worktree, ".output"), `${primary}/`)).toEqual([]);
      expect(await readFile(join(worktree, ".output", "opencode", "opencode.jsonc"), "utf-8")).toContain(
        `${worktree}/`,
      );
      expect(await commitCount(primary)).toBe(primaryCommits);
      expect(await status(primary)).toBe("");

      // The copied live file is kept aside rather than discarded.
      const kept = await filesMentioning(join(worktree, ".state", "settings-sync", "foreign"), `${primary}/`);
      expect(kept.some((path) => path.endsWith(join("opencode", "opencode.jsonc")))).toBe(true);

      // Once re-seeded, the output belongs to the worktree and later builds sync normally.
      const livePath = join(worktree, ".output", "claude-code", "settings.json");
      const live = JSON.parse(await readFile(livePath, "utf-8"));
      await writeFile(livePath, `${JSON.stringify({ ...live, harnessAddedSetting: true }, null, 2)}\n`);
      await build(worktree);
      const source = JSON.parse(await readFile(join(worktree, "harnesses", "claude-code", "settings.json"), "utf-8"));
      expect(source.harnessAddedSetting).toBe(true);
      expect(await commitCount(worktree)).toBe(worktreeCommits + 1);
      expect(await filesMentioning(join(worktree, "harnesses"), `${primary}/`)).toEqual([]);
    },
  );

  it("installs copied settings files fresh when no manifest says whose they are", async () => {
    await mkdir(join(worktree, ".output", "opencode"), { recursive: true });
    await cp(
      join(primary, ".output", "opencode", "opencode.jsonc"),
      join(worktree, ".output", "opencode", "opencode.jsonc"),
    );
    const worktreeCommits = await commitCount(worktree);

    await build(worktree);

    expect(await commitCount(worktree)).toBe(worktreeCommits);
    expect(await status(worktree)).toBe("");
    expect(await filesMentioning(join(worktree, ".output"), `${primary}/`)).toEqual([]);
  });

  it("never recovers a copied output's generated edits into either checkout's sources", async () => {
    const generatedSkill = join(primary, ".output", "claude-code", "skills", "base-skill", "SKILL.md");
    expect(existsSync(generatedSkill)).toBe(true);
    await writeFile(generatedSkill, `${await readFile(generatedSkill, "utf-8")}Edited in the primary output\n`);
    await seedWorktree({ withState: false });

    await build(worktree);

    expect(await readFile(join(primary, "skills", "base-skill", "SKILL.md"), "utf-8")).not.toContain("Edited");
    expect(await readFile(join(worktree, "skills", "base-skill", "SKILL.md"), "utf-8")).not.toContain("Edited");
    expect(await status(primary)).toBe("");
    expect(await status(worktree)).toBe("");
  });

  it("ignores a settings base copied from another checkout", async () => {
    await build(worktree);
    // Both checkouts gain the same registry setting; only the primary has built since.
    async function addRegistrySetting(root: string): Promise<void> {
      const sourcePath = join(root, "harnesses", "claude-code", "settings.json");
      const source = JSON.parse(await readFile(sourcePath, "utf-8"));
      await writeFile(sourcePath, `${JSON.stringify({ ...source, registryAddedSetting: true }, null, 2)}\n`);
      await $`git commit --quiet -am ${"add a registry setting"}`.cwd(root).quiet();
    }
    await addRegistrySetting(primary);
    await build(primary);
    await addRegistrySetting(worktree);
    await rm(join(worktree, ".state"), { recursive: true, force: true });
    await cp(join(primary, ".state"), join(worktree, ".state"), { recursive: true });
    const worktreeCommits = await commitCount(worktree);

    await build(worktree);

    // The primary's base already holds the setting, so using it would read the worktree's
    // older live file as a harness removal and delete the setting from the worktree's source.
    const sourcePath = join(worktree, "harnesses", "claude-code", "settings.json");
    expect(JSON.parse(await readFile(sourcePath, "utf-8")).registryAddedSetting).toBe(true);
    const livePath = join(worktree, ".output", "claude-code", "settings.json");
    expect(JSON.parse(await readFile(livePath, "utf-8")).registryAddedSetting).toBe(true);
    expect(await commitCount(worktree)).toBe(worktreeCommits);
    expect(await status(worktree)).toBe("");
    expect(await filesMentioning(join(worktree, ".output"), `${primary}/`)).toEqual([]);
  });

  it("keeps syncing harness edits in a checkout whose manifest predates the recorded root", async () => {
    const manifestPath = join(primary, ".output", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    delete manifest.root;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await rm(join(primary, ".state", "settings-sync", "checkout-root.json"), { force: true });
    const livePath = join(primary, ".output", "claude-code", "settings.json");
    const live = JSON.parse(await readFile(livePath, "utf-8"));
    await writeFile(livePath, `${JSON.stringify({ ...live, harnessAddedSetting: true }, null, 2)}\n`);
    const primaryCommits = await commitCount(primary);

    await build(primary);

    const source = JSON.parse(await readFile(join(primary, "harnesses", "claude-code", "settings.json"), "utf-8"));
    expect(source.harnessAddedSetting).toBe(true);
    expect(await commitCount(primary)).toBe(primaryCommits + 1);
    expect(existsSync(join(primary, ".state", "settings-sync", "foreign"))).toBe(false);
  });
});
