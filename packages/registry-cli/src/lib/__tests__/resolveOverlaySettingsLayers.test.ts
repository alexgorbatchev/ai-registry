import { factory_testRoot } from "./fixtures";
import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { resolveOverlaySettingsLayers } from "../resolveOverlaySettingsLayers";
import type { IResolveOverlaySettingsLayersOptions } from "../resolveOverlaySettingsLayers";

const TEST_ROOT = factory_testRoot("resolve-overlay-settings-layers-tests");
const createdDirectories: string[] = [];

async function writeTestFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

async function createOptions(): Promise<IResolveOverlaySettingsLayersOptions & { rootDir: string }> {
  await mkdir(TEST_ROOT, { recursive: true });
  const rootDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(rootDir);
  const stagingDir = join(rootDir, "staging");
  const harnessesDir = join(rootDir, "registry", "harnesses");
  return {
    rootDir,
    harnessesDir,
    overlayDirs: [join(rootDir, "first"), join(rootDir, "second"), join(rootDir, "empty")],
    syncedSettingsFiles: [
      { relativePath: "codex/config.toml", liveOnlyKeyPaths: [] },
      { relativePath: "opencode/opencode.jsonc", liveOnlyKeyPaths: [] },
      { relativePath: "claude-code/settings.json", liveOnlyKeyPaths: [] },
      { relativePath: "pi/settings.json", liveOnlyKeyPaths: [] },
    ],
    stagingDir,
    sourcePathByOutputPath: new Map([
      [join(stagingDir, "codex/config.toml"), join(harnessesDir, "codex", "config.toml")],
      [join(stagingDir, "opencode/opencode.jsonc"), join(harnessesDir, "opencode", "opencode.jsonc")],
      [join(stagingDir, "claude-code/settings.json"), join(rootDir, "elsewhere", "settings.json")],
    ]),
    renderLayer: async (sourcePath, content) => content.replaceAll("<%- repo_root %>", `rendered:${sourcePath}`),
  };
}

afterAll(async () => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

describe("resolveOverlaySettingsLayers", () => {
  it("returns rendered overlay layers in overlay order for each synced settings file", async () => {
    const options = await createOptions();
    const [first, second] = options.overlayDirs;
    const firstCodex = join(first ?? "", "harnesses", "codex", "config.toml");
    const secondCodex = join(second ?? "", "harnesses", "codex", "config.toml");
    const secondOpencode = join(second ?? "", "harnesses", "opencode", "opencode.jsonc");
    await writeTestFile(firstCodex, 'a = "<%- repo_root %>"\n');
    await writeTestFile(secondCodex, "b = 1\n");
    await writeTestFile(secondOpencode, "{}\n");

    const layers = await resolveOverlaySettingsLayers(options);

    expect([...layers.keys()]).toEqual(["codex/config.toml", "opencode/opencode.jsonc"]);
    expect(layers.get("codex/config.toml")).toEqual([
      { sourcePath: firstCodex, renderedText: `a = "rendered:${firstCodex}"\n` },
      { sourcePath: secondCodex, renderedText: "b = 1\n" },
    ]);
    expect(layers.get("opencode/opencode.jsonc")).toEqual([{ sourcePath: secondOpencode, renderedText: "{}\n" }]);
  });

  it("fails on overlay harness files that layer no synced settings file", async () => {
    const options = await createOptions();
    const [first] = options.overlayDirs;
    const stray = join(first ?? "", "harnesses", "codex", "rules", "extra.rules");
    const unregistered = join(first ?? "", "harnesses", "claude-code", "settings.json");
    await writeTestFile(stray, "rule\n");
    await writeTestFile(unregistered, "{}\n");

    await expect(resolveOverlaySettingsLayers(options)).rejects.toThrow(
      `Overlay harness files must layer a synced settings file at the same path under the registry's harnesses/: ${unregistered}, ${stray}`,
    );
  });

  it("returns no layers without overlays", async () => {
    const options = await createOptions();

    expect(await resolveOverlaySettingsLayers({ ...options, overlayDirs: [] })).toEqual(new Map());
  });
});
