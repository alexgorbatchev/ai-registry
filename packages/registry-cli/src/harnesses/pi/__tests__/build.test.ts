import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHarnessContext, seedRegistry } from "../../../commands/__tests__/helpers";
import { applyTemplateVariablesToGeneratedOutput } from "../../../lib/harnessBuild";
import plugin from "../build";

const scratch = join(import.meta.dir, "../.tmp/build-tests");
let root: string;
let environment: NodeJS.ProcessEnv;
beforeEach(async () => {
  environment = { ...process.env };
  delete process.env.PI_CODING_AGENT_DIR;
  delete process.env.XDG_CONFIG_HOME;
  await mkdir(scratch, { recursive: true });
  root = await mkdtemp(join(scratch, "case-"));
  await seedRegistry(root);
});
afterEach(async () => {
  process.env = environment;
  await rm(root, { recursive: true, force: true });
});
describe("pi harness", () => {
  it("builds one native root with reusable assets and harness instructions", async () => {
    await Bun.write(join(root, "harnesses/pi/instructions.md"), "Root: <%- repo_root %>\n");
    await Bun.write(join(root, "skills/agent/example/SKILL.md"), "---\nname: example\n---\nUse example.\n");
    const context = await createHarnessContext(root, "pi");
    await plugin.build(context);
    await applyTemplateVariablesToGeneratedOutput(context.outputDir, context.templateContext);
    expect(await Bun.file(join(context.outputDir, "pi/instructions.md")).text()).toBe(`Root: ${root}\n`);
    expect(await Bun.file(join(context.outputDir, "pi/skills/example/SKILL.md")).text()).toBe("---\nname: example\n---\nUse example.\n");
    expect(await Bun.file(join(context.outputDir, "pi/default/instructions.md")).exists()).toBe(false);
  });
  it("returns the standard home", async () => {
    assert(plugin.getBootstrapTargets);
    expect(await plugin.getBootstrapTargets(join(root, ".output"))).toEqual([
      { kind: "home", sourcePath: join(root, ".output/pi"), targetPath: join(homedir(), ".pi/agent"), description: "Pi config" },
    ]);
  });
  it("honors the native home override", async () => {
    process.env.PI_CODING_AGENT_DIR = join(root, "custom-home");
    assert(plugin.getBootstrapTargets);
    expect(await plugin.getBootstrapTargets(join(root, ".output"))).toEqual([
      { kind: "home", sourcePath: join(root, ".output/pi"), targetPath: join(root, "custom-home"), description: "Pi config" },
    ]);
  });
});
