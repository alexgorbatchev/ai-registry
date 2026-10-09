import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { hostname } from "node:os";

import { buildCommand } from "../buildCommand";
import type { IRegistryPaths } from "../../lib/getRegistryPaths";
import type { IGeneratedOutputManifest } from "../../lib/generatedOutputUtils";

const TEST_ROOT = join(import.meta.dir, "../../../../../.tmp/build-hostname-tests");

function skillContent(name: string, body: string, author: string = "alexgorbatchev"): string {
  return `---\nname: ${name}\ndescription: Use when testing ${name}.\nauthor: ${author}\n---\n${body}\n`;
}

describe("hostname skill variants", () => {
  let tempDir: string;
  let paths: IRegistryPaths;
  let originalEnvironment: NodeJS.ProcessEnv;

  async function write(relativePath: string, content: string): Promise<string> {
    const filePath = join(tempDir, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await Bun.write(filePath, content);
    return filePath;
  }

  function outputSkills(): string[] {
    return [
      "opencode/skills",
      "codex/default/skills",
      "codex/work/skills",
      "pi/default/skills",
      "pi/work/skills",
      "claude-code/default/skills",
      "claude-code/work/skills",
    ].map((relativePath) => join(paths.output, relativePath));
  }

  beforeEach(async () => {
    originalEnvironment = { ...process.env };
    await mkdir(TEST_ROOT, { recursive: true });
    tempDir = await mkdtemp(join(TEST_ROOT, "case-"));
    process.env.AI_REGISTRY_HOSTNAME = "workstation-a";
    process.env.XDG_DATA_HOME = join(tempDir, "data");
    const root = join(tempDir, "repo");
    paths = {
      root,
      overlay: null,
      harnesses: join(root, "harnesses"),
      skills: join(root, "skills"),
      commands: join(root, "commands"),
      profiles: join(root, "profiles"),
      output: join(root, ".output"),
      temp: join(root, ".tmp"),
    };
    await write("repo/skills/agent/example/SKILL.md", skillContent("example", "Default instructions."));
    await write("repo/skills/agent/example/references/shared.md", "Shared instructions.\n");
    await write("repo/skills/agent/example/variants/workstation-b/SKILL.md", "Other machine instructions.\n");
    for (const profile of ["default", "work"]) {
      await write(`repo/profiles/${profile}/profile.yaml`, "skills: ['*']\nsystem_prompt: Test prompt\n");
    }
    for (const target of ["opencode", "codex", "pi", "claude-code"]) {
      await write(`repo/harnesses/${target}/.registry-ignore`, "skills/\n");
    }
    await write("repo/harnesses/codex/config.toml", "model = 'test'\n");
    await write("repo/harnesses/pi/settings.json", "{}\n");
    for (const filename of ["pi-install.sh", "pi-uninstall.sh", "pi-update.sh"]) {
      await write(`repo/harnesses/pi/templates/${filename}`, await Bun.file(join(process.cwd(), "harnesses/pi/templates", filename)).text());
    }
  });

  afterEach(async () => {
    delete process.env.AI_REGISTRY_HOSTNAME;
    delete process.env.XDG_DATA_HOME;
    Object.assign(process.env, Object.fromEntries(
      Object.entries(originalEnvironment).filter(([key]) => ["AI_REGISTRY_HOSTNAME", "XDG_DATA_HOME"].includes(key)),
    ));
    await rm(tempDir, { recursive: true, force: true });
  });

  it("selects a variant in every harness and profile, rendering it once from its original path", async () => {
    await write("repo/system/common.md", "Common instructions.");
    const variantPath = await write(
      "repo/skills/agent/example/variants/workstation-a/SKILL.md",
      skillContent("example", 'Machine instructions. {{include "system/common.md"}} Source: {{file_path}}. Literal: \\{{args}}.'),
    );

    await buildCommand({ hasAutoConfirm: true, registryPaths: paths });

    for (const skillsDir of outputSkills()) {
      expect(await Bun.file(join(skillsDir, "example/SKILL.md")).text()).toBe(
        skillContent("example", `Machine instructions. Common instructions. Source: ${variantPath}. Literal: {{args}}.`),
      );
      expect(await Bun.file(join(skillsDir, "example/references/shared.md")).text()).toBe("Shared instructions.\n");
      expect(await Bun.file(join(skillsDir, "example/variants/workstation-a/SKILL.md")).exists()).toBe(false);
      expect(await Bun.file(join(skillsDir, "example/variants/workstation-b/SKILL.md")).exists()).toBe(false);
      await expect(lstat(join(skillsDir, "example/variants"))).rejects.toThrow();
    }
    expect(await Bun.file(join(paths.skills, "agent/example/SKILL.md")).text())
      .toBe(skillContent("example", "Default instructions."));
    const manifest: IGeneratedOutputManifest = await Bun.file(join(paths.output, "manifest.json")).json();
    expect(manifest.sourcePaths?.["codex/work/skills/example/SKILL.md"]).toBe(variantPath);
    expect(manifest.sourcePaths?.["opencode/skills/example/SKILL.md"]).toBe(variantPath);
  });

  it("falls back to the default without rendering unmatched variants", async () => {
    await write("repo/skills/agent/example/variants/workstation-b/SKILL.md", "{{unknown_variable}}\n");
    await buildCommand({ hasAutoConfirm: true, registryPaths: paths });
    for (const skillsDir of outputSkills()) {
      expect(await Bun.file(join(skillsDir, "example/SKILL.md")).text())
        .toBe(skillContent("example", "Default instructions."));
      expect(await Bun.file(join(skillsDir, "example/variants/workstation-b/SKILL.md")).exists()).toBe(false);
    }
  });

  it("uses the operating system hostname when the override is absent", async () => {
    delete process.env.AI_REGISTRY_HOSTNAME;
    await write(`repo/skills/agent/example/variants/${hostname()}/SKILL.md`, skillContent("example", "Detected machine."));
    await buildCommand({ hasAutoConfirm: true, registryPaths: paths });
    expect(await Bun.file(join(paths.output, "codex/default/skills/example/SKILL.md")).text())
      .toBe(skillContent("example", "Detected machine."));
  });

  it.each(["Workstation-a", "workstation-a.example.test"])("matches hostname %s exactly", async (buildHostname) => {
    process.env.AI_REGISTRY_HOSTNAME = buildHostname;
    await write("repo/skills/agent/example/variants/workstation-a/SKILL.md", skillContent("example", "Different machine."));
    await buildCommand({ hasAutoConfirm: true, registryPaths: paths });
    expect(await Bun.file(join(paths.output, "codex/default/skills/example/SKILL.md")).text())
      .toBe(skillContent("example", "Default instructions."));
  });

  it("selects a private overlay variant after replacing the public bundle", async () => {
    paths.overlay = join(tempDir, "overlay");
    await write("repo/skills/agent/example/variants/workstation-a/SKILL.md", skillContent("example", "Public variant."));
    await write("overlay/skills/agent/example/SKILL.md", skillContent("example", "Private default."));
    await write("overlay/skills/agent/example/variants/workstation-a/SKILL.md", skillContent("example", "Private variant."));
    await buildCommand({ hasAutoConfirm: true, registryPaths: paths });
    for (const skillsDir of outputSkills()) {
      expect(await Bun.file(join(skillsDir, "example/SKILL.md")).text()).toBe(skillContent("example", "Private variant."));
      expect(await Bun.file(join(skillsDir, "example/references/shared.md")).exists()).toBe(false);
    }
  });

  it("uses the overlay default when only the public bundle has a matching variant", async () => {
    paths.overlay = join(tempDir, "overlay");
    await write("repo/skills/agent/example/variants/workstation-a/SKILL.md", skillContent("example", "Public variant."));
    await write("overlay/skills/agent/example/SKILL.md", skillContent("example", "Private default."));
    await buildCommand({ hasAutoConfirm: true, registryPaths: paths });
    for (const skillsDir of outputSkills()) {
      expect(await Bun.file(join(skillsDir, "example/SKILL.md")).text()).toBe(skillContent("example", "Private default."));
    }
  });

  it("preserves harness override precedence with variants", async () => {
    await write("repo/skills/agent/example/variants/workstation-a/SKILL.md", "Invalid overridden variant.");
    for (const target of ["opencode", "codex", "pi", "claude-code"]) {
      await write(`repo/harnesses/${target}/skills/agent/example/SKILL.md`, skillContent("example", "Harness default."));
      await write(`repo/harnesses/${target}/skills/agent/example/variants/workstation-a/SKILL.md`, skillContent("example", "Harness variant."));
    }
    await buildCommand({ hasAutoConfirm: true, registryPaths: paths });
    for (const skillsDir of outputSkills()) {
      expect(await Bun.file(join(skillsDir, "example/SKILL.md")).text()).toBe(skillContent("example", "Harness variant."));
    }
  });

  it("selects profile-local skill variants", async () => {
    await write("repo/profiles/work/skills/local-example/SKILL.md", skillContent("local-example", "Local default."));
    await write("repo/profiles/work/skills/local-example/variants/workstation-a/SKILL.md", skillContent("local-example", "Local variant."));
    await buildCommand({ hasAutoConfirm: true, registryPaths: paths });
    for (const target of ["codex", "pi", "claude-code"]) {
      expect(await Bun.file(join(paths.output, target, "work/skills/local-example/SKILL.md")).text())
        .toBe(skillContent("local-example", "Local variant."));
    }
    expect(await Bun.file(join(paths.output, "opencode/skills/local-example/SKILL.md")).text())
      .toBe(skillContent("local-example", "Local variant."));
  });

  it("preserves author prefixes and user invocation policy", async () => {
    await write("repo/skills/user/manual-example/SKILL.md", skillContent("manual-example", "Manual default.", "upstream"));
    await write("repo/skills/user/manual-example/variants/workstation-a/SKILL.md", skillContent("manual-example", "Manual variant.", "upstream"));
    await buildCommand({ hasAutoConfirm: true, registryPaths: paths });
    for (const skillsDir of outputSkills()) {
      expect(await Bun.file(join(skillsDir, "upstream-manual-example/SKILL.md")).text()).toBe(
        "---\ndisable-model-invocation: true\nname: upstream-manual-example\ndescription: Use when testing manual-example.\nauthor: upstream\n---\nManual variant.\n",
      );
    }
  });

  it.each([
    ["missing frontmatter", "Instructions without frontmatter."],
    ["invalid YAML", "---\nname: [\n---\nInstructions."],
    ["non-mapping YAML", "---\n- example\n---\nInstructions."],
    ["missing description", "---\nname: example\nauthor: alexgorbatchev\n---\nInstructions."],
    ["empty description", "---\nname: example\ndescription: ''\nauthor: alexgorbatchev\n---\nInstructions."],
    ["changed name", skillContent("another-example", "Instructions.")],
    ["changed author", skillContent("example", "Instructions.", "another-author")],
    ["empty body", skillContent("example", "")],
  ])("rejects a matching variant with %s instead of falling back", async (_label, content) => {
    await write("repo/skills/agent/example/variants/workstation-a/SKILL.md", content);
    await expect(buildCommand({ hasAutoConfirm: true, registryPaths: paths })).rejects.toThrow();
    expect(await Bun.file(join(paths.output, "manifest.json")).exists()).toBe(false);
  });

  it("rejects a matching variant directory without SKILL.md", async () => {
    await write("repo/skills/agent/example/variants/workstation-a/notes.md", "Incomplete variant.");
    await expect(buildCommand({ hasAutoConfirm: true, registryPaths: paths })).rejects.toThrow();
  });

  it("rejects a matching variant path that is a file", async () => {
    await write("repo/skills/agent/example/variants/workstation-a", "Not a variant directory.");
    await expect(buildCommand({ hasAutoConfirm: true, registryPaths: paths })).rejects.toThrow(
      `Invalid hostname skill variant directory: ${join(paths.skills, "agent/example/variants/workstation-a")}`,
    );
  });

  it.each(["", " ", "../escape", "nested/host", "nested\\host", ".", "..", "host\nname"])(
    "rejects unsafe or empty hostname overrides: %j", async (override) => {
      process.env.AI_REGISTRY_HOSTNAME = override;
      await expect(buildCommand({ hasAutoConfirm: true, registryPaths: paths })).rejects.toThrow();
    },
  );
});
