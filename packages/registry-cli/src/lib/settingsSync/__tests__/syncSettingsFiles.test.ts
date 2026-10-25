import { afterAll, afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { existsSync } from "fs";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "fs/promises";
import { basename, dirname, join } from "path";

import type { ITemplateContext } from "../../harnessBuild";
import { syncSettingsFiles, validateStagedSettingsFiles } from "../syncSettingsFiles";
import type { ISyncSettingsFilesOptions } from "../syncSettingsFiles";
import type { ISettingsSourceRepository, SettingsKeyPath, SettingsSourceState } from "../types";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "sync-settings-files-tests");
const createdDirectories: string[] = [];
const JSONC_RELATIVE_PATH = "opencode/opencode.jsonc";
const TOML_RELATIVE_PATH = "codex/default/config.toml";

interface ITestLayout {
  rootDir: string;
  relativePath: string;
  sourcePath: string;
  stagedPath: string;
  livePath: string;
  basePath: string;
  stagingDir: string;
  outputDir: string;
  stateDir: string;
  templateContext: ITemplateContext;
}

interface IRecordingSourceRepository extends ISettingsSourceRepository {
  commits: string[][];
}

async function createLayout(relativePath: string = JSONC_RELATIVE_PATH): Promise<ITestLayout> {
  await mkdir(TEST_ROOT, { recursive: true });
  const rootDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(rootDir);
  const stagingDir = join(rootDir, ".tmp", "staging");
  const outputDir = join(rootDir, ".output");
  const stateDir = join(rootDir, ".tmp", "settings-sync");
  return {
    rootDir,
    relativePath,
    sourcePath: join(rootDir, "harnesses", "harness", basename(relativePath)),
    stagedPath: join(stagingDir, relativePath),
    livePath: join(outputDir, relativePath),
    basePath: join(stateDir, `${relativePath}.json`),
    stagingDir,
    outputDir,
    stateDir,
    templateContext: { repo_root: rootDir },
  };
}

function createRecordingSourceRepository(sourceState: SettingsSourceState, hasSecrets = false): IRecordingSourceRepository {
  const commits: string[][] = [];
  return {
    commits,
    getSourceState: async () => sourceState,
    hasSecrets: async () => hasSecrets,
    commit: async (sourcePaths) => {
      commits.push(sourcePaths);
    },
  };
}

async function writeTestFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

function createOptions(
  layout: ITestLayout,
  sourceRepository: ISettingsSourceRepository,
  liveOnlyKeyPaths: SettingsKeyPath[] = [],
): ISyncSettingsFilesOptions {
  return {
    syncedSettingsFiles: [{ relativePath: layout.relativePath, liveOnlyKeyPaths }],
    stagingDir: layout.stagingDir,
    outputDir: layout.outputDir,
    stateDir: layout.stateDir,
    sourcePathByOutputPath: new Map([[layout.stagedPath, layout.sourcePath]]),
    templateContext: layout.templateContext,
    sourceRepository,
  };
}

async function runSync(
  layout: ITestLayout,
  sourceRepository: ISettingsSourceRepository = createRecordingSourceRepository("unversioned"),
  liveOnlyKeyPaths: SettingsKeyPath[] = [],
): Promise<void> {
  await syncSettingsFiles(createOptions(layout, sourceRepository, liveOnlyKeyPaths));
}

// Writes the registry source plus the copy the build renders from it.
async function writeSource(layout: ITestLayout, sourceText: string): Promise<void> {
  await writeTestFile(layout.sourcePath, sourceText);
  await writeTestFile(layout.stagedPath, sourceText.replaceAll("<%- repo_root %>", layout.rootDir));
}

afterEach(() => {
  mock.restore();
});

afterAll(async () => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

describe("syncSettingsFiles", () => {
  it("installs the rendered settings and records them as the base on the first build", async () => {
    const layout = await createLayout();
    const sourceText = '{\n  "plugin": ["file://<%- repo_root %>/vendor/a.ts"]\n}\n';
    await writeSource(layout, sourceText);

    await runSync(layout);

    expect(await readFile(layout.livePath, "utf-8")).toBe(`{\n  "plugin": ["file://${layout.rootDir}/vendor/a.ts"]\n}\n`);
    expect(JSON.parse(await readFile(layout.basePath, "utf-8"))).toEqual({
      plugin: [`file://${layout.rootDir}/vendor/a.ts`],
    });
    expect(await readFile(layout.sourcePath, "utf-8")).toBe(sourceText);
  });

  it("writes harness edits back to the source with repository paths turned back into template tags", async () => {
    const layout = await createLayout();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    await writeSource(layout, '{\n  // shared plugins\n  "plugin": ["file://<%- repo_root %>/vendor/a.ts"]\n}\n');
    await runSync(layout);
    await writeTestFile(
      layout.livePath,
      `{\n  "plugin": ["file://${layout.rootDir}/vendor/a.ts", "file://${layout.rootDir}/vendor/b.ts"],\n  "model": "opus"\n}\n`,
    );

    await runSync(layout);

    expect(await readFile(layout.sourcePath, "utf-8")).toBe(
      [
        "{",
        "  // shared plugins",
        '  "plugin": [',
        '    "file://<%- repo_root %>/vendor/a.ts",',
        '    "file://<%- repo_root %>/vendor/b.ts"',
        "  ],",
        '  "model": "opus"',
        "}",
        "",
      ].join("\n"),
    );
    expect(logSpy.mock.calls).toEqual([[`  - ↩️ Synced 2 harness settings changes into ${layout.sourcePath}`]]);
    expect(JSON.parse(await readFile(layout.basePath, "utf-8"))).toEqual({
      plugin: [`file://${layout.rootDir}/vendor/a.ts`, `file://${layout.rootDir}/vendor/b.ts`],
      model: "opus",
    });
  });

  it("commits harness edits written into a source file that had no uncommitted edits", async () => {
    const layout = await createLayout();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const sourceRepository = createRecordingSourceRepository("clean");
    await writeSource(layout, '{\n  "theme": "dark"\n}\n');
    await runSync(layout, sourceRepository);
    await writeTestFile(layout.livePath, '{\n  "theme": "light"\n}\n');

    await runSync(layout, sourceRepository);

    expect(sourceRepository.commits).toEqual([[layout.sourcePath]]);
    expect(logSpy.mock.calls).toEqual([
      [`  - ↩️ Synced 1 harness settings change into ${layout.sourcePath}`],
      [`  - 📝 Committed synced settings: ${layout.sourcePath}`],
    ]);
  });

  it("leaves harness edits uncommitted when the source file already had uncommitted edits", async () => {
    const layout = await createLayout();
    spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const sourceRepository = createRecordingSourceRepository("dirty");
    await writeSource(layout, '{\n  "theme": "dark"\n}\n');
    await runSync(layout, sourceRepository);
    await writeTestFile(layout.livePath, '{\n  "theme": "light"\n}\n');

    await runSync(layout, sourceRepository);

    expect(sourceRepository.commits).toEqual([]);
    expect(await readFile(layout.sourcePath, "utf-8")).toBe('{\n  "theme": "light"\n}\n');
    expect(warnSpy.mock.calls).toEqual([
      [`  - ⚠️ Left synced settings uncommitted in ${layout.sourcePath}: it already had uncommitted edits.`],
    ]);
  });

  it("leaves harness edits uncommitted when gitleaks finds possible secrets in the source file", async () => {
    const layout = await createLayout();
    spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const sourceRepository = createRecordingSourceRepository("clean", true);
    await writeSource(layout, '{\n  "theme": "dark"\n}\n');
    await runSync(layout, sourceRepository);
    await writeTestFile(layout.livePath, '{\n  "theme": "light"\n}\n');

    await runSync(layout, sourceRepository);

    expect(sourceRepository.commits).toEqual([]);
    expect(warnSpy.mock.calls).toEqual([
      [`  - ⚠️ Left synced settings uncommitted in ${layout.sourcePath}: gitleaks found possible secrets.`],
    ]);
  });

  it("replaces a live settings symlink from an earlier layout with a regular file", async () => {
    const layout = await createLayout(TOML_RELATIVE_PATH);
    spyOn(console, "log").mockImplementation(() => {});
    const legacyPath = join(layout.rootDir, ".tmp", "codex", "config.toml");
    await writeSource(layout, 'model = "gpt-5"\n');
    await writeTestFile(legacyPath, 'model = "gpt-6"\n');
    await chmod(legacyPath, 0o600);
    await mkdir(dirname(layout.livePath), { recursive: true });
    await symlink(legacyPath, layout.livePath);

    await runSync(layout);

    expect((await lstat(layout.livePath)).isSymbolicLink()).toBe(false);
    expect((await stat(layout.livePath)).mode & 0o777).toBe(0o600);
    expect(await readFile(layout.livePath, "utf-8")).toBe('model = "gpt-6"\n');
    expect(await readFile(layout.sourcePath, "utf-8")).toBe('model = "gpt-6"\n');
  });

  it("installs the settings fresh when the live file is a dangling symlink", async () => {
    const layout = await createLayout();
    await writeSource(layout, '{\n  "theme": "dark"\n}\n');
    await mkdir(dirname(layout.livePath), { recursive: true });
    await symlink(join(layout.rootDir, "missing.jsonc"), layout.livePath);

    await runSync(layout);

    expect((await lstat(layout.livePath)).isSymbolicLink()).toBe(false);
    expect(await readFile(layout.livePath, "utf-8")).toBe('{\n  "theme": "dark"\n}\n');
  });

  it("syncs TOML settings, keeping comments and live-only tables out of the source", async () => {
    const layout = await createLayout(TOML_RELATIVE_PATH);
    spyOn(console, "log").mockImplementation(() => {});
    await writeSource(layout, '# shared defaults\nmodel = "gpt-5"\n');
    await runSync(layout, undefined, [["projects"]]);
    await writeTestFile(
      layout.livePath,
      `# shared defaults\nmodel = "gpt-6"\n\n[projects."${layout.rootDir}/app"]\ntrust_level = "trusted"\n`,
    );

    await runSync(layout, undefined, [["projects"]]);

    expect(await readFile(layout.sourcePath, "utf-8")).toBe('# shared defaults\nmodel = "gpt-6"\n');
    expect(await readFile(layout.livePath, "utf-8")).toBe(
      `# shared defaults\nmodel = "gpt-6"\n\n[projects."${layout.rootDir}/app"]\ntrust_level = "trusted"\n`,
    );
  });

  it("applies registry edits to the live file without touching harness-only keys", async () => {
    const layout = await createLayout();
    await writeSource(layout, '{\n  "theme": "dark"\n}\n');
    await runSync(layout);
    await writeTestFile(layout.livePath, '{\n  "theme": "dark",\n  "lastChangelogVersion": "1.2.0"\n}\n');
    await writeSource(layout, '{\n  "theme": "light"\n}\n');

    await runSync(layout, undefined, [["lastChangelogVersion"]]);

    expect(await readFile(layout.livePath, "utf-8")).toBe('{\n  "theme": "light",\n  "lastChangelogVersion": "1.2.0"\n}\n');
    expect(await readFile(layout.sourcePath, "utf-8")).toBe('{\n  "theme": "light"\n}\n');
  });

  it("reports values both sides changed and keeps the registry version", async () => {
    const layout = await createLayout();
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    await writeSource(layout, '{\n  "theme": "dark"\n}\n');
    await runSync(layout);
    await writeTestFile(layout.livePath, '{\n  "theme": "light"\n}\n');
    await writeSource(layout, '{\n  "theme": "solarized"\n}\n');

    await runSync(layout);

    expect(await readFile(layout.livePath, "utf-8")).toBe('{\n  "theme": "solarized"\n}\n');
    expect(warnSpy.mock.calls).toEqual([
      [
        '  - ⚠️ opencode/opencode.jsonc: `theme` differs between the registry and the harness; kept the registry value (registry: "solarized", harness: "light")',
      ],
    ]);
  });

  it("leaves both files alone when nothing changed", async () => {
    const layout = await createLayout();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const sourceRepository = createRecordingSourceRepository("clean");
    await writeSource(layout, '{\n  "theme": "dark"\n}\n');
    await runSync(layout, sourceRepository);

    await runSync(layout, sourceRepository);

    expect(await readFile(layout.livePath, "utf-8")).toBe('{\n  "theme": "dark"\n}\n');
    expect(await readFile(layout.sourcePath, "utf-8")).toBe('{\n  "theme": "dark"\n}\n');
    expect(logSpy.mock.calls).toEqual([]);
    expect(sourceRepository.commits).toEqual([]);
  });

  it("rejects an unparsable staged settings file during validation", async () => {
    const layout = await createLayout();
    await writeSource(layout, '{ "theme": }\n');

    await expect(validateStagedSettingsFiles(createOptions(layout, createRecordingSourceRepository("clean")))).rejects.toThrow(
      `Cannot sync settings file ${layout.sourcePath}: ValueExpected at offset 11.`,
    );
  });

  it("fails when no registry source produced the synced file", async () => {
    const layout = await createLayout();
    await writeTestFile(layout.stagedPath, "{}\n");

    await expect(
      syncSettingsFiles({ ...createOptions(layout, createRecordingSourceRepository("clean")), sourcePathByOutputPath: new Map() }),
    ).rejects.toThrow("Cannot sync settings file opencode/opencode.jsonc: no registry source file produced it.");
    expect(existsSync(layout.livePath)).toBe(false);
  });
});
