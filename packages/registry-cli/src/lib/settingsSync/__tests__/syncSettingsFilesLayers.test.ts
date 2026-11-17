import { factory_testRoot } from "./fixtures";
import { afterAll, afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { syncSettingsFiles, validateStagedSettingsFiles } from "../syncSettingsFiles";
import type { ISyncSettingsFilesOptions } from "../syncSettingsFiles";
import type { ISettingsSourceRepository, ISyncedSettingsFile, SettingsSourceState } from "../types";

const TEST_ROOT = factory_testRoot("sync-settings-layers-tests");
const createdDirectories: string[] = [];

interface ILayout {
  rootDir: string;
  publicSourcePath: string;
  overlaySourcePath: string;
  stagingDir: string;
  outputDir: string;
  stateDir: string;
}

interface IRecordingSourceRepository extends ISettingsSourceRepository {
  commits: string[][];
}

async function writeTestFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf-8"));
}

async function createLayout(fileName: string): Promise<ILayout> {
  await mkdir(TEST_ROOT, { recursive: true });
  const rootDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(rootDir);
  return {
    rootDir,
    publicSourcePath: join(rootDir, "registry", "harnesses", "harness", fileName),
    overlaySourcePath: join(rootDir, "overlay", "harnesses", "harness", fileName),
    stagingDir: join(rootDir, "staging"),
    outputDir: join(rootDir, "output"),
    stateDir: join(rootDir, "state"),
  };
}

function createRecordingSourceRepository(sourceState: SettingsSourceState): IRecordingSourceRepository {
  const commits: string[][] = [];
  return {
    commits,
    getSourceState: async () => sourceState,
    hasSecrets: async () => false,
    commit: async (sourcePaths) => {
      commits.push(sourcePaths);
    },
  };
}

// Writes the public and overlay sources; the staged copy is the public source as rendered.
async function writeSources(layout: ILayout, file: ISyncedSettingsFile, publicText: string, overlayText: string) {
  await writeTestFile(layout.publicSourcePath, publicText);
  await writeTestFile(join(layout.stagingDir, file.relativePath), publicText);
  await writeTestFile(layout.overlaySourcePath, overlayText);
}

function createOptions(
  layout: ILayout,
  file: ISyncedSettingsFile,
  sourceRepository: ISettingsSourceRepository,
): Promise<ISyncSettingsFilesOptions> {
  return readFile(layout.overlaySourcePath, "utf-8").then((overlayText) => ({
    syncedSettingsFiles: [file],
    stagingDir: layout.stagingDir,
    outputDir: layout.outputDir,
    stateDir: layout.stateDir,
    sourcePathByOutputPath: new Map([[join(layout.stagingDir, file.relativePath), layout.publicSourcePath]]),
    templateContext: { repo_root: layout.rootDir },
    sourceRepository,
    overlayLayers: new Map([
      [file.relativePath, [{ sourcePath: layout.overlaySourcePath, renderedText: overlayText }]],
    ]),
  }));
}

async function runSync(
  layout: ILayout,
  file: ISyncedSettingsFile,
  sourceRepository: ISettingsSourceRepository = createRecordingSourceRepository("unversioned"),
): Promise<void> {
  await syncSettingsFiles(await createOptions(layout, file, sourceRepository));
}

afterEach(() => {
  mock.restore();
});

afterAll(async () => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

describe("syncSettingsFiles with overlay layers", () => {
  const file: ISyncedSettingsFile = { relativePath: "harness/settings.json", liveOnlyKeyPaths: [] };

  it("installs the public source with the overlay merged over it", async () => {
    const layout = await createLayout("settings.json");
    await writeSources(
      layout,
      file,
      '{\n  // shared\n  "model": "a",\n  "mcp": { "shared": { "url": "public" } }\n}\n',
      '{ "mcp": { "private": { "url": "overlay" } } }\n',
    );

    await runSync(layout, file);

    const liveText = await readFile(join(layout.outputDir, file.relativePath), "utf-8");
    expect(liveText).toContain("// shared");
    expect(JSON.parse(liveText.replace("// shared\n", ""))).toEqual({
      model: "a",
      mcp: { shared: { url: "public" }, private: { url: "overlay" } },
    });
  });

  it("writes each harness edit into the layer that owns its key and commits both files", async () => {
    const layout = await createLayout("settings.json");
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const sourceRepository = createRecordingSourceRepository("clean");
    await writeSources(
      layout,
      file,
      '{\n  "model": "a",\n  "mcp": { "shared": { "url": "public" } }\n}\n',
      '{\n  "mcp": { "private": { "url": "overlay" } }\n}\n',
    );
    await runSync(layout, file, sourceRepository);
    await writeTestFile(
      join(layout.outputDir, file.relativePath),
      '{"model":"b","mcp":{"shared":{"url":"public"},"private":{"url":"changed"},"added":{"url":"new"}}}\n',
    );

    await runSync(layout, file, sourceRepository);

    expect(await readJson(layout.publicSourcePath)).toEqual({ model: "b", mcp: { shared: { url: "public" } } });
    expect(await readJson(layout.overlaySourcePath)).toEqual({
      mcp: { private: { url: "changed" }, added: { url: "new" } },
    });
    expect(sourceRepository.commits).toEqual([[layout.publicSourcePath, layout.overlaySourcePath]]);
    expect(logSpy.mock.calls).toEqual([
      [`  - ↩️ Synced 1 harness settings change into ${layout.publicSourcePath}`],
      [`  - ↩️ Synced 2 harness settings changes into ${layout.overlaySourcePath}`],
      [`  - 📝 Committed synced settings: ${layout.publicSourcePath}, ${layout.overlaySourcePath}`],
    ]);
  });

  it("removes a key the harness deleted from every layer that defines it", async () => {
    const layout = await createLayout("settings.json");
    spyOn(console, "log").mockImplementation(() => {});
    await writeSources(layout, file, '{"model":"a","theme":"dark"}\n', '{"model":"b"}\n');
    await runSync(layout, file);
    await writeTestFile(join(layout.outputDir, file.relativePath), '{"theme":"dark"}\n');

    await runSync(layout, file);

    expect(await readJson(layout.publicSourcePath)).toEqual({ theme: "dark" });
    expect(await readJson(layout.overlaySourcePath)).toEqual({});
  });

  it("rejects an unparsable overlay layer during validation", async () => {
    const layout = await createLayout("settings.json");
    await writeSources(layout, file, "{}\n", '{ "model": }\n');

    await expect(
      validateStagedSettingsFiles(await createOptions(layout, file, createRecordingSourceRepository("clean"))),
    ).rejects.toThrow(`Cannot sync settings file ${layout.overlaySourcePath}: ValueExpected at offset 11.`);
  });
});

describe("syncSettingsFiles with a tool overlay layer", () => {
  const file: ISyncedSettingsFile = { relativePath: "harness/settings.json", liveOnlyKeyPaths: [] };
  const guard = { matcher: "Bash", hooks: [{ type: "command", command: "guard" }] };
  const toolHook = { hooks: [{ type: "command", command: "tool" }] };
  const userHook = { hooks: [{ type: "command", command: "user" }] };

  // Stages the public source again before each run, as every build does.
  async function runToolSync(
    layout: ILayout,
    hasTool: boolean,
    traits: { ownedMarkers?: string[]; homeDir?: string } = {},
  ): Promise<void> {
    await writeTestFile(join(layout.stagingDir, file.relativePath), await readFile(layout.publicSourcePath, "utf-8"));
    const toolText = await readFile(layout.overlaySourcePath, "utf-8");
    await syncSettingsFiles({
      syncedSettingsFiles: [file],
      stagingDir: layout.stagingDir,
      outputDir: layout.outputDir,
      stateDir: layout.stateDir,
      sourcePathByOutputPath: new Map([[join(layout.stagingDir, file.relativePath), layout.publicSourcePath]]),
      templateContext: { repo_root: layout.rootDir },
      sourceRepository: createRecordingSourceRepository("unversioned"),
      overlayLayers: new Map(
        hasTool
          ? [
              [
                file.relativePath,
                [
                  {
                    sourcePath: layout.overlaySourcePath,
                    renderedText: toolText.replaceAll("<%- env('HOME') %>", traits.homeDir ?? ""),
                    isTool: true,
                    ...(traits.ownedMarkers ? { ownedMarkers: traits.ownedMarkers } : {}),
                  },
                ],
              ],
            ]
          : [],
      ),
      ...(traits.homeDir ? { homeDir: traits.homeDir } : {}),
    });
  }

  it("adds a tool's hooks, keeps new harness hooks out of the tool, and removes the tool's hooks with it", async () => {
    const layout = await createLayout("settings.json");
    spyOn(console, "log").mockImplementation(() => {});
    const livePath = join(layout.outputDir, file.relativePath);
    await writeSources(
      layout,
      file,
      `${JSON.stringify({ hooks: { PreToolUse: [guard] } })}\n`,
      `${JSON.stringify({ hooks: { PreToolUse: [toolHook], SessionStart: [toolHook] } })}\n`,
    );

    await runToolSync(layout, true);
    expect(await readJson(livePath)).toEqual({
      hooks: { PreToolUse: [guard, toolHook], SessionStart: [toolHook] },
    });

    await writeTestFile(livePath, `${JSON.stringify({ hooks: { PreToolUse: [guard, toolHook, userHook] } })}\n`);
    await runToolSync(layout, true);
    expect(await readJson(layout.publicSourcePath)).toEqual({ hooks: { PreToolUse: [guard, userHook] } });
    expect(await readJson(layout.overlaySourcePath)).toEqual({ hooks: { PreToolUse: [toolHook] } });

    await runToolSync(layout, false);
    expect(await readJson(livePath)).toEqual({ hooks: { PreToolUse: [guard, userHook] } });
    expect(await readJson(layout.publicSourcePath)).toEqual({ hooks: { PreToolUse: [guard, userHook] } });
  });

  it("syncs a tool's own rewritten and added hooks into its overlay with the home directory templated", async () => {
    const layout = await createLayout("settings.json");
    spyOn(console, "log").mockImplementation(() => {});
    const homeDir = join(TEST_ROOT, "homes", "example-user");
    const livePath = join(layout.outputDir, file.relativePath);
    const toolCommand = (event: string, timeout: number) => ({
      hooks: [{ type: "command", command: `${homeDir}/.example-tool/hook.sh ${event}`, timeout }],
    });
    const templated = (event: string, timeout: number) => ({
      hooks: [{ type: "command", command: `<%- env('HOME') %>/.example-tool/hook.sh ${event}`, timeout }],
    });
    const traits = { ownedMarkers: [".example-tool/"], homeDir };
    await writeSources(
      layout,
      file,
      `${JSON.stringify({ hooks: { Stop: [guard] } })}\n`,
      `${JSON.stringify({ hooks: { Stop: [templated("stop", 5)] } })}\n`,
    );
    await runToolSync(layout, true, traits);
    expect(await readJson(livePath)).toEqual({ hooks: { Stop: [guard, toolCommand("stop", 5)] } });

    await writeTestFile(
      livePath,
      `${JSON.stringify({ hooks: { Stop: [guard, toolCommand("stop", 7), userHook], Notification: [toolCommand("notify", 7)] } })}\n`,
    );
    await runToolSync(layout, true, traits);

    expect(await readJson(layout.publicSourcePath)).toEqual({ hooks: { Stop: [guard, userHook] } });
    expect(await readJson(layout.overlaySourcePath)).toEqual({
      hooks: { Stop: [templated("stop", 7)], Notification: [templated("notify", 7)] },
    });
  });
});
