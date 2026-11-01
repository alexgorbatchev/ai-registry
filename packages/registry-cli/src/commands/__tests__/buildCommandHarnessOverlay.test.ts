import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { buildCommand } from "../buildCommand";
import type { IRegistryPaths } from "../../lib/getRegistryPaths";
import { readGeneratedOutputManifest } from "../../lib/readGeneratedOutputManifest";
import { seedRegistry } from "./helpers";

const targets = ["claude-code", "codex", "opencode", "pi"];
const scratch = join(import.meta.dir, "../../../../../.tmp/harness-overlay-tests");
let root: string;
let paths: IRegistryPaths;
let first: string;
let last: string;
const skill = (text: string) => `---\nname: example\ndescription: Exercise layered skill selection.\n---\n${text}\n`;

beforeEach(async () => {
  await mkdir(scratch, { recursive: true });
  root = await mkdtemp(join(scratch, "case-"));
  paths = await seedRegistry(join(root, "public"));
  first = join(root, "first");
  last = join(root, "last");
  paths.overlays = [first, last];
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const build = () => buildCommand({ registryPaths: paths, hasAutoConfirm: true });

describe("native harness overlays", () => {
  it("layers files in every harness, respects per-layer ignores, and records winning source paths", async () => {
    for (const target of targets) {
      await Bun.write(join(paths.harnesses, target, "native/base.txt"), "public-only\n");
      await Bun.write(join(paths.harnesses, target, "native/shared.txt"), "public\n");
      await Bun.write(join(first, "harnesses", target, "native/shared.txt"), "first\n");
      await Bun.write(join(first, "harnesses", target, "native/first.txt"), "first-only\n");
      await Bun.write(join(last, "harnesses", target, "native/shared.txt"), "Selected: <%- file_path %>\n");
      await Bun.write(join(last, "harnesses", target, "native/.registry-ignore"), "./ignored.txt\n");
      await Bun.write(join(last, "harnesses", target, "native/ignored.txt"), "private build input\n");
    }
    await build();
    const manifest = await readGeneratedOutputManifest(paths.output);
    assert(manifest);
    for (const target of targets) {
      const source = join(last, "harnesses", target, "native/shared.txt");
      expect(await Bun.file(join(paths.output, target, "native/shared.txt")).text()).toBe(`Selected: ${source}\n`);
      expect(await Bun.file(join(paths.output, target, "native/base.txt")).text()).toBe("public-only\n");
      expect(await Bun.file(join(paths.output, target, "native/first.txt")).text()).toBe("first-only\n");
      expect(await Bun.file(join(paths.output, target, "native/ignored.txt")).exists()).toBe(false);
      expect(manifest.sourcePaths?.[`${target}/native/shared.txt`]).toBe(source);
      expect(await Bun.file(join(paths.harnesses, target, "native/shared.txt")).text()).toBe("public\n");
    }
  });

  it("replaces complete skill bundles after reusable and public harness layers", async () => {
    await Bun.write(join(paths.skills, "agent/example/SKILL.md"), skill("public reusable"));
    await Bun.write(join(last, "skills/agent/example/SKILL.md"), skill("private reusable"));
    for (const target of targets) {
      await Bun.write(join(paths.harnesses, target, "skills/agent/example/SKILL.md"), skill("public harness"));
      await Bun.write(join(first, "harnesses", target, "skills/agent/example/SKILL.md"), skill("first harness"));
      await Bun.write(join(first, "harnesses", target, "skills/agent/example/stale.txt"), "must not survive\n");
      await Bun.write(join(last, "harnesses", target, "skills/user/example/SKILL.md"), skill("last harness"));
      await Bun.write(join(last, "harnesses", target, "skills/user/example/current.txt"), "selected resource\n");
    }
    await build();
    for (const target of targets) {
      const bundle = join(paths.output, target, "skills/example");
      expect(await Bun.file(join(bundle, "SKILL.md")).text()).toBe("---\ndisable-model-invocation: true\nname: example\ndescription: Exercise layered skill selection.\n---\nlast harness\n");
      expect(await Bun.file(join(bundle, "current.txt")).text()).toBe("selected resource\n");
      expect(await Bun.file(join(bundle, "stale.txt")).exists()).toBe(false);
    }
  });

  it("gives native commands and prompts precedence over reusable commands", async () => {
    await Bun.write(join(paths.commands, "example.md"), "---\ndescription: Reusable command.\n---\nReusable\n");
    for (const [target, dir] of [["claude-code", "commands"], ["opencode", "commands"], ["pi", "prompts"]]) {
      await Bun.write(join(last, "harnesses", target, dir, "example.md"), `Native ${target}\n`);
    }
    await build();
    for (const [target, dir] of [["claude-code", "commands"], ["opencode", "commands"], ["pi", "prompts"]]) {
      expect(await Bun.file(join(paths.output, target, dir, "example.md")).text()).toBe(`Native ${target}\n`);
    }
    expect(await Bun.file(join(paths.output, "codex/skills/command-example/SKILL.md")).text()).toBe("---\ndescription: Reusable command.\n---\nReusable\n");
  });

  it("syncs live settings into the winning overlay without changing public or earlier overlay files", async () => {
    const configs: Record<string, [string, string, string]> = {
      codex: ["config.toml", 'model = "private"\n', 'model = "changed"\n'],
      pi: ["settings.json", '{"theme":"private"}\n', '{"theme":"changed"}\n'],
      "claude-code": ["settings.json", '{"theme":"private"}\n', '{"theme":"changed"}\n'],
      opencode: ["opencode.jsonc", '{"theme":"private"}\n', '{"theme":"changed"}\n'],
    };
    for (const [target, [name, content]] of Object.entries(configs)) {
      await Bun.write(join(paths.harnesses, target, name), content.replace("private", "public"));
      await Bun.write(join(first, "harnesses", target, name), content.replace("private", "first"));
      await Bun.write(join(last, "harnesses", target, name), content);
    }
    await build();
    for (const [target, [name, , updated]] of Object.entries(configs)) await Bun.write(join(paths.output, target, name), updated);
    await build();
    for (const [target, [name, content, updated]] of Object.entries(configs)) {
      const parsers: Record<string, (text: string) => unknown> = { codex: Bun.TOML.parse, pi: JSON.parse, "claude-code": JSON.parse, opencode: JSON.parse };
      const parse = parsers[target]!;
      expect(parse(await Bun.file(join(last, "harnesses", target, name)).text())).toEqual(parse(updated));
      expect(await Bun.file(join(paths.harnesses, target, name)).text()).toBe(content.replace("private", "public"));
      expect(await Bun.file(join(first, "harnesses", target, name)).text()).toBe(content.replace("private", "first"));
    }
  });

  it("recovers generated native-file edits into the selected overlay", async () => {
    const source = join(last, "harnesses/codex/native.txt");
    await Bun.write(source, "Original\n");
    await build();
    await Bun.write(join(paths.output, "codex/native.txt"), "Edited\n");
    await build();
    expect(await Bun.file(source).text()).toBe("Edited\n");
    expect(await Bun.file(join(paths.output, "codex/native.txt")).text()).toBe("Edited\n");
  });

  it("preserves generated edits when changing the selected overlay source", async () => {
    await Bun.write(join(first, "harnesses/codex/native.txt"), "Original\n");
    await Bun.write(join(last, "harnesses/codex/native.txt"), "Original\n");
    await build();
    await Bun.write(join(paths.output, "codex/native.txt"), "Keep this edit\n");
    paths.overlays = [first];
    await expect(build()).rejects.toThrow("selected skill source changed");
    expect(await Bun.file(join(paths.output, "codex/native.txt")).text()).toBe("Keep this edit\n");
    expect(await Bun.file(join(first, "harnesses/codex/native.txt")).text()).toBe("Original\n");
  });
});
