import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

import plugin from "../../pi/build";
import { createSettingsSyncRegistry } from "../../../lib/settingsSync/createSettingsSyncRegistry";
import { createHarnessBuildContext, type IHarnessBuildContextOptions } from "../../__tests__/createHarnessBuildContext";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "pi-build-tests");
const originalPiCodingAgentDir: string | undefined = process.env.PI_CODING_AGENT_DIR;

async function createOutputDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  return mkdtemp(join(TEST_ROOT, "case-"));
}

async function writeTestFile(rootDir: string, relativePath: string, content: string): Promise<string> {
  const filePath = join(rootDir, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

async function writeHarnessFixture(repositoryRoot: string): Promise<void> {
  await writeTestFile(repositoryRoot, "system/system.md", "Follow the repo guidance.\nEscalate risky changes.\n");
  await writeTestFile(repositoryRoot, "harnesses/pi/settings.json", "{}\n");
  for (const helperName of ["pi-install", "pi-uninstall", "pi-update"]) {
    await writeTestFile(
      repositoryRoot,
      `harnesses/pi/templates/${helperName}.sh`,
      `#!/usr/bin/env bash\n# ${helperName}\n`,
    );
  }
}

function buildOutput(repositoryRoot: string, options: IHarnessBuildContextOptions = {}): Promise<void> {
  return plugin.buildOutput(createHarnessBuildContext(repositoryRoot, "pi", options));
}

function getBootstrapTargets(): NonNullable<typeof plugin.getBootstrapTargets> {
  assert(plugin.getBootstrapTargets);
  return plugin.getBootstrapTargets;
}

describe("Pi harness build", () => {
  beforeEach(() => {
    delete process.env.PI_CODING_AGENT_DIR;
  });

  afterEach(async () => {
    if (originalPiCodingAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalPiCodingAgentDir;
    }

    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("applies the generated Pi root to ~/.pi/agent", async () => {
    const outputDir = await createOutputDirectory();

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        description: "Pi config",
        sourcePath: join(outputDir, "pi"),
        targetPath: join(homedir(), ".pi", "agent"),
      },
    ]);
  });

  it("uses PI_CODING_AGENT_DIR and links the generated web search config", async () => {
    const outputDir = await createOutputDirectory();
    const targetPath = join(outputDir, "custom-pi-agent");
    await writeTestFile(outputDir, "pi/web-search.json", "{}\n");
    process.env.PI_CODING_AGENT_DIR = targetPath;

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      { kind: "home", description: "Pi config", sourcePath: join(outputDir, "pi"), targetPath },
      {
        kind: "link",
        description: "Pi web search config",
        sourcePath: join(outputDir, "pi", "web-search.json"),
        targetPath: join(homedir(), ".pi", "web-search.json"),
      },
    ]);
  });

  it("builds the Pi root from the system prompt, settings, prompts, and skills", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/prompts/harness.md", "Harness prompt.\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/skills/harness-skill/SKILL.md", "# Harness skill\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/models.json", '{"providers":{}}\n');
    await writeTestFile(repositoryRoot, "harnesses/pi/web-search.json", '{"provider":"none"}\n');
    await writeTestFile(repositoryRoot, "harnesses/pi/extensions/timestamps.ts", "// timestamps extension\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    await buildOutput(repositoryRoot, { skills: ["shared-skill"], commands: ["review.md"] });

    const outputDir = join(repositoryRoot, ".output", "pi");
    expect(await readFile(join(outputDir, "APPEND_SYSTEM.md"), "utf-8")).toBe(
      "Follow the repo guidance.\nEscalate risky changes.\n",
    );
    expect(await readFile(join(outputDir, "settings.json"), "utf-8")).toBe("{}\n");
    expect(await readFile(join(outputDir, "models.json"), "utf-8")).toBe('{"providers":{}}\n');
    expect(await readFile(join(outputDir, "web-search.json"), "utf-8")).toBe('{"provider":"none"}\n');
    expect(await readFile(join(outputDir, "extensions", "timestamps.ts"), "utf-8")).toBe("// timestamps extension\n");
    expect(await readFile(join(outputDir, "prompts", "review.md"), "utf-8")).toBe("Review the changes.\n");
    expect(await readFile(join(outputDir, "prompts", "harness.md"), "utf-8")).toBe("Harness prompt.\n");
    for (const skillName of ["shared-skill", "harness-skill"]) {
      expect((await lstat(join(outputDir, "skills", skillName, "SKILL.md"))).isSymbolicLink()).toBe(false);
    }
    expect(await readFile(join(outputDir, "skills", "shared-skill", "SKILL.md"), "utf-8")).toBe("# Shared skill\n");
    expect(await readFile(join(outputDir, "skills", "harness-skill", "SKILL.md"), "utf-8")).toBe("# Harness skill\n");
  });

  it("keeps runtime state and optional files out of a minimal Pi root", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");

    await buildOutput(repositoryRoot, { commands: ["review.md"] });

    // Sessions belong to the real `~/.pi/agent` home that bootstrap links these
    // entries into, so the build creates none of them.
    expect((await readdir(join(repositoryRoot, ".output", "pi"))).sort()).toEqual([
      "APPEND_SYSTEM.md",
      "prompts",
      "settings.json",
      "skills",
    ]);
  });

  it("rejects a harness prompt that collides with a registry command", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Registry review.\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/prompts/review.md", "Harness review.\n");

    await expect(buildOutput(repositoryRoot, { commands: ["review.md"] })).rejects.toThrow(
      `Cannot merge generated output because destination already exists: ${join(repositoryRoot, ".output", "pi", "prompts", "review.md")}`,
    );
  });

  it("registers settings.json for settings sync with the version stamps kept live-only", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);

    const settingsSyncRegistry = createSettingsSyncRegistry(join(repositoryRoot, ".output"));
    await buildOutput(repositoryRoot, { settingsSyncRegistry });

    expect(settingsSyncRegistry.getSyncedSettingsFiles()).toEqual([
      {
        relativePath: "pi/settings.json",
        liveOnlyKeyPaths: [["lastChangelogVersion"], ["extensionChangelogVersions"]],
      },
    ]);
  });

  it("generates the Pi install helpers without a bare pi wrapper", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);

    await buildOutput(repositoryRoot);

    // No bare `pi` wrapper is generated: the real `pi` binary already reads
    // `~/.pi/agent`, where bootstrap applies the generated root.
    const binDir = join(repositoryRoot, ".output", "bin");
    expect((await readdir(binDir)).sort()).toEqual(["pi-install", "pi-uninstall", "pi-update"]);
    expect(await readFile(join(binDir, "pi-update"), "utf-8")).toBe("#!/usr/bin/env bash\n# pi-update\n");
  });

  it("overrides global skills with harness-specific skills on collision", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Global version\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/extra.txt", "global extra\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/skills/shared-skill/SKILL.md", "# Harness version\n");

    await buildOutput(repositoryRoot, { skills: ["shared-skill"] });

    const skillDir = join(repositoryRoot, ".output", "pi", "skills", "shared-skill");
    expect(await readFile(join(skillDir, "SKILL.md"), "utf-8")).toBe("# Harness version\n");
    expect(existsSync(join(skillDir, "extra.txt"))).toBe(false);
  });

  it("stages grouped harness skills (agent and user), injecting disable-model-invocation for user skills", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(
      repositoryRoot,
      "harnesses/pi/skills/agent/harness-agent-skill/SKILL.md",
      "---\nname: harness-agent-skill\n---\n# Agent\n",
    );
    await writeTestFile(
      repositoryRoot,
      "harnesses/pi/skills/user/harness-user-skill/SKILL.md",
      "---\nname: harness-user-skill\n---\n# User\n",
    );

    await buildOutput(repositoryRoot);

    const skillsDir = join(repositoryRoot, ".output", "pi", "skills");
    expect(await readFile(join(skillsDir, "harness-agent-skill", "SKILL.md"), "utf-8")).toBe(
      "---\nname: harness-agent-skill\n---\n# Agent\n",
    );
    expect(await readFile(join(skillsDir, "harness-user-skill", "SKILL.md"), "utf-8")).toBe(
      "---\ndisable-model-invocation: true\nname: harness-user-skill\n---\n# User\n",
    );
  });
});
