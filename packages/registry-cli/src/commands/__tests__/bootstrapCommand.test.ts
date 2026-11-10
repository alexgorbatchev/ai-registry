import { factory_testRoot } from "./fixtures";
import { afterAll, afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { $ } from "bun";
import { existsSync } from "fs";
import { lstat, mkdir, mkdtemp, readFile, readlink, realpath, rm, symlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { bootstrapCommand, type IBootstrapDependencies } from "../bootstrapCommand";
import type { IRegistryPaths } from "../../lib/getRegistryPaths";
import type { IBootstrapTarget, IUnifiedHarnessPlugin } from "../../lib/harnessBuild";
import type { IRunCommandSpawnOptions, IRunCommandSpawnedProcess } from "../../lib/runCommand";

const TEST_ROOT = factory_testRoot("bootstrap-command-tests");

afterAll(async () => {
  await rm(TEST_ROOT, { recursive: true, force: true });
});
const TIMESTAMP = "20261026T000000Z";

async function writeTestFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

describe("bootstrapCommand", () => {
  let root: string;
  let homeDir: string;
  let registryPaths: IRegistryPaths;
  let spawnedCommands: string[][];
  let logLines: string[];

  // Stands in for `just setup` and `just build`: the build step writes the
  // generated harness output, a public wrapper, and the manifest that bootstrap reads.
  function createSpawn(buildExitCode = 0): (options: IRunCommandSpawnOptions) => IRunCommandSpawnedProcess {
    return (options) => {
      spawnedCommands.push(options.cmd);
      const isBuild = options.cmd[1] === "build";
      const exited =
        isBuild && buildExitCode === 0
          ? writeGeneratedOutput().then(() => 0)
          : Promise.resolve(isBuild ? buildExitCode : 0);
      return { exited };
    };
  }

  async function writeGeneratedOutput(): Promise<void> {
    await writeTestFile(join(registryPaths.output, "fake", "AGENTS.md"), "instructions\n");
    await writeTestFile(join(registryPaths.output, "fake", "settings.json"), "{}\n");
    await writeTestFile(join(registryPaths.output, "bin", "air-fake"), "#!/usr/bin/env bash\n");
    await writeTestFile(
      join(registryPaths.output, "manifest.json"),
      JSON.stringify({
        version: 2,
        generatedAt: "2026-10-26T00:00:00.000Z",
        entries: {
          "bin/air-fake": { kind: "file", checksum: "a" },
          "fake/AGENTS.md": { kind: "file", checksum: "b" },
        },
        syncedFilePaths: ["fake/settings.json"],
      }),
    );
  }

  const fakePlugin: IUnifiedHarnessPlugin = {
    target: "fake",
    async buildOutput(): Promise<void> {},
    async getBootstrapTargets(outputDir: string): Promise<IBootstrapTarget[]> {
      return [
        {
          kind: "home",
          sourcePath: join(outputDir, "fake"),
          targetPath: join(homeDir, ".fake"),
          description: "Fake home",
        },
        {
          kind: "link",
          sourcePath: join(outputDir, "fake", "settings.json"),
          targetPath: join(homeDir, "fake-settings.json"),
          description: "Fake settings",
        },
      ];
    },
  };

  function createDependencies(overrides: Partial<IBootstrapDependencies> = {}): IBootstrapDependencies {
    return {
      registryPaths,
      argv: ["bun", "bootstrap.ts", "-y"],
      plugins: [fakePlugin],
      publicBinDir: join(homeDir, ".local", "bin"),
      getTimestamp: () => TIMESTAMP,
      spawn: createSpawn(),
      ...overrides,
    };
  }

  function getLog(): string {
    return logLines.join("\n").replaceAll(root, "<root>");
  }

  beforeEach(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    root = await mkdtemp(join(TEST_ROOT, "case-"));
    homeDir = join(root, "home");
    registryPaths = {
      root: join(root, "repo"),
      overlays: [],
      harnesses: join(root, "repo", "harnesses"),
      skills: join(root, "repo", "skills"),
      commands: join(root, "repo", "commands"),
      systemPrompt: join(root, "repo", "system", "system.md"),
      output: join(root, "repo", ".output"),
      temp: join(root, "repo", ".tmp"),
      state: join(root, "repo", ".state"),
    };
    spawnedCommands = [];
    logLines = [];
    spyOn(console, "log").mockImplementation((...values: unknown[]) => {
      logLines.push(values.join(" "));
    });
  });

  afterEach(async () => {
    mock.restore();
    await rm(root, { recursive: true, force: true });
  });

  it("installs, builds, and applies every target while keeping existing runtime state", async () => {
    await writeTestFile(join(homeDir, ".fake", "history.jsonl"), "kept\n");

    await bootstrapCommand(createDependencies());

    expect(spawnedCommands).toEqual([
      ["just", "setup"],
      ["just", "build", "-y"],
    ]);
    expect((await lstat(join(homeDir, ".fake"))).isDirectory()).toBe(true);
    expect(await readFile(join(homeDir, ".fake", "history.jsonl"), "utf-8")).toBe("kept\n");
    expect(await readlink(join(homeDir, ".fake", "AGENTS.md"))).toBe(join(registryPaths.output, "fake", "AGENTS.md"));
    expect(await readlink(join(homeDir, "fake-settings.json"))).toBe(
      join(registryPaths.output, "fake", "settings.json"),
    );
    expect(await readlink(join(homeDir, ".local", "bin", "air-fake"))).toBe(
      join(registryPaths.output, "bin", "air-fake"),
    );
    expect(getLog()).toMatchInlineSnapshot(`
"🚀 Bootstrapping ai-registry...

Installing dependencies and Git hooks...
Building generated outputs...
Applying generated outputs...
  applied Fake home: <root>/home/.fake
    linked: AGENTS.md, settings.json
  linked Fake settings: <root>/home/fake-settings.json
Syncing repo-local public scripts...
  linked air-fake: <root>/home/.local/bin/air-fake

Ready.
Fake home now reads from: <root>/home/.fake
Fake settings now reads from: <root>/home/fake-settings.json
Repo-local air-*, claude-*, codex-*, and pi-* commands are linked into: <root>/home/.local/bin
Override the targets with OPENCODE_CONFIG_DIR, CODEX_HOME, PI_CODING_AGENT_DIR, and CLAUDE_CONFIG_DIR if needed."
`);
  });

  it("reports reused, repointed, backed-up, and removed entries on a later run", async () => {
    await bootstrapCommand(createDependencies());
    const otherCheckout = join(root, "other-checkout");
    await writeTestFile(join(otherCheckout, "AGENTS.md"), "other\n");
    await rm(join(homeDir, ".fake", "AGENTS.md"));
    await symlink(join(otherCheckout, "AGENTS.md"), join(homeDir, ".fake", "AGENTS.md"));
    await rm(join(homeDir, ".fake", "settings.json"));
    await writeTestFile(join(homeDir, ".fake", "settings.json"), '{"local":true}\n');
    await symlink(join(registryPaths.output, "fake", "removed"), join(homeDir, ".fake", "removed"));
    await rm(join(homeDir, "fake-settings.json"));
    await writeTestFile(join(homeDir, "fake-settings.json"), '{"local":true}\n');
    await rm(join(homeDir, ".local", "bin", "air-fake"));
    await symlink(join(otherCheckout, "air-fake"), join(homeDir, ".local", "bin", "air-fake"));
    logLines = [];

    await bootstrapCommand(createDependencies({ argv: ["bun", "bootstrap.ts"] }));

    expect(spawnedCommands.slice(2)).toEqual([
      ["just", "setup"],
      ["just", "build"],
    ]);
    expect(getLog()).toMatchInlineSnapshot(`
"🚀 Bootstrapping ai-registry...

Installing dependencies and Git hooks...
Building generated outputs...
Applying generated outputs...
  applied Fake home: <root>/home/.fake
    relinked: AGENTS.md
    backed up settings.json to: <root>/home/.fake/settings.json.backup-20261026T000000Z
    removed stale links: removed
  linked Fake settings: <root>/home/fake-settings.json
    backed up previous contents to: <root>/home/fake-settings.json.backup-20261026T000000Z
Syncing repo-local public scripts...
  removed broken link: <root>/home/.local/bin/air-fake
  linked air-fake: <root>/home/.local/bin/air-fake

Ready.
Fake home now reads from: <root>/home/.fake
Fake settings now reads from: <root>/home/fake-settings.json
Repo-local air-*, claude-*, codex-*, and pi-* commands are linked into: <root>/home/.local/bin
Override the targets with OPENCODE_CONFIG_DIR, CODEX_HOME, PI_CODING_AGENT_DIR, and CLAUDE_CONFIG_DIR if needed."
`);
  });

  it("reports reused links and the overlay on an unchanged run", async () => {
    await bootstrapCommand(createDependencies());
    logLines = [];

    await bootstrapCommand(
      createDependencies({ registryPaths: { ...registryPaths, overlays: [join(root, "overlay")] } }),
    );

    expect(getLog()).toMatchInlineSnapshot(`
"🚀 Bootstrapping ai-registry...

📦 Using overlay: <root>/overlay

Installing dependencies and Git hooks...
Building generated outputs...
Applying generated outputs...
  applied Fake home: <root>/home/.fake
  reused Fake settings: <root>/home/fake-settings.json
Syncing repo-local public scripts...
  reused air-fake: <root>/home/.local/bin/air-fake

Ready.
Overlay merged: <root>/overlay
Fake home now reads from: <root>/home/.fake
Fake settings now reads from: <root>/home/fake-settings.json
Repo-local air-*, claude-*, codex-*, and pi-* commands are linked into: <root>/home/.local/bin
Override the targets with OPENCODE_CONFIG_DIR, CODEX_HOME, PI_CODING_AGENT_DIR, and CLAUDE_CONFIG_DIR if needed."
`);
  });

  it("refuses to run in a linked worktree before installing or building anything", async () => {
    const primary = join(root, "primary");
    const worktree = join(root, "worktree");
    await mkdir(primary, { recursive: true });
    await $`git init -q -b main && git -c user.name=test -c user.email=test@example.invalid commit -q --allow-empty -m init`
      .cwd(primary)
      .quiet();
    await $`git worktree add -q ${worktree}`.cwd(primary).quiet();
    const primaryPath = await realpath(primary);

    await expect(
      bootstrapCommand(createDependencies({ registryPaths: { ...registryPaths, root: worktree } })),
    ).rejects.toThrow(
      `Bootstrap links this machine's harness homes to the checkout it runs in, so it runs only from the primary checkout ${primaryPath}, not the linked worktree ${worktree}.`,
    );
    expect(spawnedCommands).toEqual([]);
    expect(existsSync(join(homeDir, ".fake"))).toBe(false);
  });

  it("stops before touching any home when the build fails", async () => {
    await expect(bootstrapCommand(createDependencies({ spawn: createSpawn(2) }))).rejects.toThrow(
      "Failed to build generated outputs (exit code 2).\nGenerated edits are recovered automatically when safe. Resolve any reported source conflict, unsupported recovery, or save failure before retrying; -y does not discard edits.",
    );
    expect(existsSync(join(homeDir, ".fake"))).toBe(false);
  });

  it("refuses to apply targets without a generated output manifest", async () => {
    const spawn = (options: IRunCommandSpawnOptions): IRunCommandSpawnedProcess => {
      spawnedCommands.push(options.cmd);
      return { exited: Promise.resolve(0) };
    };

    await expect(bootstrapCommand(createDependencies({ spawn }))).rejects.toThrow(
      `Generated output manifest is missing from ${registryPaths.output}. Rebuild before bootstrapping.`,
    );
  });
});
