import { factory_testRoot } from "./fixtures";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { delimiter, join, relative } from "path";

import { getRegistryPaths, listToolOverlays, readToolManifest, resolvePathWithHome } from "../getRegistryPaths";

const TEST_ROOT = factory_testRoot("getRegistryPaths");

describe("getRegistryPaths", () => {
  const originalEnv = process.env.AI_REGISTRY_OVERLAY;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(TEST_ROOT, "registry-paths-test-"));
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env.AI_REGISTRY_OVERLAY;
    } else {
      process.env.AI_REGISTRY_OVERLAY = originalEnv;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns no overlays when AI_REGISTRY_OVERLAY is not set", () => {
    delete process.env.AI_REGISTRY_OVERLAY;
    const paths = getRegistryPaths();
    expect(paths.overlays).toEqual([]);
    expect(paths.skills).toBe(join(paths.root, "skills"));
    expect(paths.commands).toBe(join(paths.root, "commands"));
    expect(paths.systemPrompt).toBe(join(paths.root, "system", "system.md"));
  });

  it("returns no overlays when AI_REGISTRY_OVERLAY is whitespace", () => {
    process.env.AI_REGISTRY_OVERLAY = "   ";
    const paths = getRegistryPaths();
    expect(paths.overlays).toEqual([]);
  });

  it("resolves overlay when AI_REGISTRY_OVERLAY points to an existing absolute path", () => {
    process.env.AI_REGISTRY_OVERLAY = tempDir;
    const paths = getRegistryPaths();
    expect(paths.overlays).toEqual([tempDir]);
  });

  it("resolves overlay with tilde (~) expansion", () => {
    const relativeToHome = tempDir.slice(homedir().length).replace(/^[/\\]+/, "");
    process.env.AI_REGISTRY_OVERLAY = `~/${relativeToHome}`;
    const paths = getRegistryPaths();
    expect(paths.overlays).toEqual([tempDir]);
  });

  it("warns and skips a missing path while preserving a relative overlay", () => {
    const nonExistent = join(tempDir, "does-not-exist");
    process.env.AI_REGISTRY_OVERLAY = [nonExistent, relative(process.cwd(), tempDir)].join(delimiter);
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const paths = getRegistryPaths();
    expect(paths.overlays).toEqual([tempDir]);
    expect(warnSpy).toHaveBeenCalledWith(
      `⚠️ Overlay directory does not exist: ${nonExistent} (from AI_REGISTRY_OVERLAY)`,
    );
    warnSpy.mockRestore();
  });

  it("resolves path with home correctly", () => {
    expect(resolvePathWithHome("~/foo/bar", "/some/root")).toBe(join(homedir(), "foo", "bar"));
    expect(resolvePathWithHome("~", "/some/root")).toBe(homedir());
    expect(resolvePathWithHome("/absolute/path", "/some/root")).toBe("/absolute/path");
    expect(resolvePathWithHome("relative/path", "/some/root")).toBe(join("/some/root", "relative", "path"));
  });

  it("resolves a path list with empty entries and keeps the last duplicate", async () => {
    const first = join(tempDir, "first");
    const second = join(tempDir, "second");
    await mkdir(first);
    await mkdir(second);
    process.env.AI_REGISTRY_OVERLAY = ["", first, second, join(first, "."), " "].join(delimiter);
    expect(getRegistryPaths().overlays).toEqual([second, first]);
  });
});

describe("listToolOverlays", () => {
  it("lists tool directories sorted by name, skipping files and hidden entries", async () => {
    const toolsDir = await mkdtemp(join(TEST_ROOT, "tools-"));
    await mkdir(join(toolsDir, "zeta"));
    await mkdir(join(toolsDir, "alpha"));
    await mkdir(join(toolsDir, ".hidden"));
    await writeFile(join(toolsDir, "README.md"), "notes\n");

    expect(listToolOverlays(toolsDir)).toEqual([join(toolsDir, "alpha"), join(toolsDir, "zeta")]);
    await rm(toolsDir, { recursive: true, force: true });
  });

  it("skips a tool whose required paths are missing and keeps one whose paths exist", async () => {
    const toolsDir = await mkdtemp(join(TEST_ROOT, "tools-"));
    await mkdir(join(toolsDir, "installed", "bin"), { recursive: true });
    await writeFile(join(toolsDir, "installed", "bin", "hook.sh"), "");
    await writeFile(join(toolsDir, "installed", "tool.json"), JSON.stringify({ requires: ["bin/hook.sh", "~"] }));
    await mkdir(join(toolsDir, "missing"));
    await writeFile(join(toolsDir, "missing", "tool.json"), JSON.stringify({ requires: ["~/.no-such-tool-xyz/hook"] }));
    await mkdir(join(toolsDir, "plain"));
    await writeFile(join(toolsDir, "plain", "tool.json"), "{}");
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    expect(listToolOverlays(toolsDir)).toEqual([join(toolsDir, "installed"), join(toolsDir, "plain")]);
    expect(logSpy).toHaveBeenCalledWith(
      `⏭️ Skipping tool overlay ${join(toolsDir, "missing")}: ${join(homedir(), ".no-such-tool-xyz", "hook")} does not exist on this machine`,
    );
    logSpy.mockRestore();
    await rm(toolsDir, { recursive: true, force: true });
  });

  it("rejects a tool manifest whose requires is not a list of paths", async () => {
    const toolsDir = await mkdtemp(join(TEST_ROOT, "tools-"));
    await mkdir(join(toolsDir, "broken"));
    await writeFile(join(toolsDir, "broken", "tool.json"), JSON.stringify({ requires: "hook.sh" }));

    expect(() => listToolOverlays(toolsDir)).toThrow(
      `${join(toolsDir, "broken", "tool.json")}: "requires" must be a list of non-empty strings`,
    );
    await rm(toolsDir, { recursive: true, force: true });
  });

  it("returns no tools when the directory is missing", () => {
    expect(listToolOverlays(join(TEST_ROOT, "missing-tools"))).toEqual([]);
  });

  it("reads tools from the registry root", () => {
    expect(getRegistryPaths().tools).toEqual(listToolOverlays(join(getRegistryPaths().root, "tools")));
  });
});

describe("readToolManifest", () => {
  it("reads owned markers and resolves required paths", async () => {
    const toolDir = await mkdtemp(join(TEST_ROOT, "tool-"));
    await writeFile(join(toolDir, "tool.json"), JSON.stringify({ requires: ["bin/x"], owns: [".example-tool/"] }));

    expect(readToolManifest(toolDir)).toEqual({ requires: [join(toolDir, "bin", "x")], owns: [".example-tool/"] });
    await rm(toolDir, { recursive: true, force: true });
  });

  it("rejects owned markers that are not a list of strings", async () => {
    const toolDir = await mkdtemp(join(TEST_ROOT, "tool-"));
    await writeFile(join(toolDir, "tool.json"), JSON.stringify({ owns: [""] }));

    expect(() => readToolManifest(toolDir)).toThrow(`"owns" must be a list of non-empty strings`);
    await rm(toolDir, { recursive: true, force: true });
  });
});
