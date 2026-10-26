import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { existsSync } from "fs";
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { bootstrapCommand, type IBootstrapDependencies } from "../bootstrapCommand";
import type { IRegistryPaths } from "../../lib/getRegistryPaths";
import type { IBootstrapTarget, IUnifiedHarnessPlugin } from "../../lib/harnessBuild";
import type { IRunCommandSpawnOptions, IRunCommandSpawnedProcess } from "../../lib/runCommand";

const TEST_ROOT = join(import.meta.dir, "..", "..", "..", ".tmp", "bootstrap-command-tests");
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

  // Stands in for `bun install` and `bun run build`: the build step writes the
  // generated profile, a public wrapper, and the manifest that bootstrap reads.
  function createSpawn(buildExitCode = 0): (options: IRunCommandSpawnOptions) => IRunCommandSpawnedProcess {
    return (options) => {
      spawnedCommands.push(options.cmd);
      const isBuild = options.cmd[2] === "build";
      const exited = isBuild && buildExitCode === 0
        ? writeGeneratedOutput().then(() => 0)
        : Promise.resolve(isBuild ? buildExitCode : 0);
      return { exited };
    };
  }

  async function writeGeneratedOutput(): Promise<void> {
    await writeTestFile(join(registryPaths.output, "fake", "default", "AGENTS.md"), "instructions\n");
    await writeTestFile(join(registryPaths.output, "fake", "default", "settings.json"), "{}\n");
    await writeTestFile(join(registryPaths.output, "fake", "designer", "AGENTS.md"), "designer\n");
    await writeTestFile(join(registryPaths.output, "bin", "claude-designer"), "#!/usr/bin/env bash\n");
    await writeTestFile(
      join(registryPaths.output, "manifest.json"),
      JSON.stringify({
        version: 2,
        generatedAt: "2026-10-26T00:00:00.000Z",
        entries: {
          "bin/claude-designer": { kind: "file", checksum: "a" },
          "fake/default/AGENTS.md": { kind: "file", checksum: "b" },
          "fake/designer/AGENTS.md": { kind: "file", checksum: "c" },
        },
        syncedFilePaths: ["fake/default/settings.json"],
      }),
    );
  }

  const fakePlugin: IUnifiedHarnessPlugin = {
    target: "fake",
    async getBootstrapTargets(outputDir: string): Promise<IBootstrapTarget[]> {
      return [
        { kind: "home", sourcePath: join(outputDir, "fake", "default"), targetPath: join(homeDir, ".fake"), description: "Fake home (default)" },
        {
          kind: "home",
          sourcePath: join(outputDir, "fake", "designer"),
          targetPath: join(homeDir, "profiles", "designer"),
          description: "Fake profile home (designer)",
          sharedHomePath: join(homeDir, ".fake"),
        },
        {
          kind: "link",
          sourcePath: join(outputDir, "fake", "default", "settings.json"),
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
      overlay: null,
      harnesses: join(root, "repo", "harnesses"),
      skills: join(root, "repo", "skills"),
      commands: join(root, "repo", "commands"),
      profiles: join(root, "repo", "profiles"),
      output: join(root, "repo", ".output"),
      temp: join(root, "repo", ".tmp"),
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

    expect(spawnedCommands).toEqual([["bun", "install"], ["bun", "run", "build", "--", "-y"]]);
    expect((await lstat(join(homeDir, ".fake"))).isDirectory()).toBe(true);
    expect(await readFile(join(homeDir, ".fake", "history.jsonl"), "utf-8")).toBe("kept\n");
    expect(await readlink(join(homeDir, ".fake", "AGENTS.md"))).toBe(join(registryPaths.output, "fake", "default", "AGENTS.md"));
    expect(await readlink(join(homeDir, "profiles", "designer", "history.jsonl"))).toBe(join(homeDir, ".fake", "history.jsonl"));
    expect(await readlink(join(homeDir, "fake-settings.json"))).toBe(join(registryPaths.output, "fake", "default", "settings.json"));
    expect(await readlink(join(homeDir, ".local", "bin", "claude-designer"))).toBe(
      join(registryPaths.output, "bin", "claude-designer"),
    );
    expect(getLog()).toMatchInlineSnapshot(`
"🚀 Bootstrapping ai-registry...

Installing dependencies...
Building generated outputs...
Applying generated outputs...
  applied Fake home (default): <root>/home/.fake
    linked: AGENTS.md, settings.json
  applied Fake profile home (designer): <root>/home/profiles/designer
    linked: AGENTS.md
    shared runtime entries: history.jsonl
  linked Fake settings: <root>/home/fake-settings.json
Syncing repo-local public scripts...
  linked claude-designer: <root>/home/.local/bin/claude-designer

Ready.
Fake home (default) now reads from: <root>/home/.fake
Fake profile home (designer) now reads from: <root>/home/profiles/designer
Fake settings now reads from: <root>/home/fake-settings.json
Repo-local air-*, claude-*, codex-*, and pi-* commands are linked into: <root>/home/.local/bin
Override the targets with OPENCODE_CONFIG_DIR, CODEX_HOME, PI_CODING_AGENT_DIR, and CLAUDE_CONFIG_DIR if needed."
`);
  });

  it("reports reused, repointed, backed-up, removed, and diverged entries on a later run", async () => {
    await writeTestFile(join(homeDir, ".fake", "history.jsonl"), "shared\n");
    await bootstrapCommand(createDependencies());
    const otherCheckout = join(root, "other-checkout");
    await writeTestFile(join(otherCheckout, "AGENTS.md"), "other\n");
    await rm(join(homeDir, ".fake", "AGENTS.md"));
    await symlink(join(otherCheckout, "AGENTS.md"), join(homeDir, ".fake", "AGENTS.md"));
    await rm(join(homeDir, ".fake", "settings.json"));
    await writeTestFile(join(homeDir, ".fake", "settings.json"), "{\"local\":true}\n");
    await symlink(join(registryPaths.output, "fake", "default", "removed"), join(homeDir, ".fake", "removed"));
    await rm(join(homeDir, "profiles", "designer", "history.jsonl"));
    await writeTestFile(join(homeDir, "profiles", "designer", "history.jsonl"), "designer only\n");
    await rm(join(homeDir, "fake-settings.json"));
    await writeTestFile(join(homeDir, "fake-settings.json"), "{\"local\":true}\n");
    await rm(join(homeDir, ".local", "bin", "claude-designer"));
    await symlink(join(otherCheckout, "claude-designer"), join(homeDir, ".local", "bin", "claude-designer"));
    logLines = [];

    await bootstrapCommand(createDependencies({ argv: ["bun", "bootstrap.ts"] }));

    expect(spawnedCommands.slice(2)).toEqual([["bun", "install"], ["bun", "run", "build"]]);
    expect(getLog()).toMatchInlineSnapshot(`
"🚀 Bootstrapping ai-registry...

Installing dependencies...
Building generated outputs...
Applying generated outputs...
  applied Fake home (default): <root>/home/.fake
    relinked: AGENTS.md
    backed up settings.json to: <root>/home/.fake/settings.json.backup-20261026T000000Z
    removed stale links: removed
  applied Fake profile home (designer): <root>/home/profiles/designer
    own copies hiding the shared home's entries (move them aside to share again): history.jsonl
  linked Fake settings: <root>/home/fake-settings.json
    backed up previous contents to: <root>/home/fake-settings.json.backup-20261026T000000Z
Syncing repo-local public scripts...
  removed broken link: <root>/home/.local/bin/claude-designer
  linked claude-designer: <root>/home/.local/bin/claude-designer

Ready.
Fake home (default) now reads from: <root>/home/.fake
Fake profile home (designer) now reads from: <root>/home/profiles/designer
Fake settings now reads from: <root>/home/fake-settings.json
Repo-local air-*, claude-*, codex-*, and pi-* commands are linked into: <root>/home/.local/bin
Override the targets with OPENCODE_CONFIG_DIR, CODEX_HOME, PI_CODING_AGENT_DIR, and CLAUDE_CONFIG_DIR if needed."
`);
  });

  it("reports reused links and the overlay on an unchanged run", async () => {
    await bootstrapCommand(createDependencies());
    logLines = [];

    await bootstrapCommand(createDependencies({ registryPaths: { ...registryPaths, overlay: join(root, "overlay") } }));

    expect(getLog()).toMatchInlineSnapshot(`
"🚀 Bootstrapping ai-registry...

📦 Using overlay: <root>/overlay

Installing dependencies...
Building generated outputs...
Applying generated outputs...
  applied Fake home (default): <root>/home/.fake
  applied Fake profile home (designer): <root>/home/profiles/designer
  reused Fake settings: <root>/home/fake-settings.json
Syncing repo-local public scripts...
  reused claude-designer: <root>/home/.local/bin/claude-designer

Ready.
Overlay merged: <root>/overlay
Fake home (default) now reads from: <root>/home/.fake
Fake profile home (designer) now reads from: <root>/home/profiles/designer
Fake settings now reads from: <root>/home/fake-settings.json
Repo-local air-*, claude-*, codex-*, and pi-* commands are linked into: <root>/home/.local/bin
Override the targets with OPENCODE_CONFIG_DIR, CODEX_HOME, PI_CODING_AGENT_DIR, and CLAUDE_CONFIG_DIR if needed."
`);
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
