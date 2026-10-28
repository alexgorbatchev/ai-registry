import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, rm } from "fs/promises";
import { homedir } from "os";
import { delimiter, join, relative } from "path";

import { getRegistryPaths, resolvePathWithHome } from "../getRegistryPaths";

describe("getRegistryPaths", () => {
  const originalEnv = process.env.AI_REGISTRY_OVERLAY;
  let tempDir: string;

  beforeEach(async () => {
    await mkdir(join(process.cwd(), ".tmp"), { recursive: true });
    tempDir = await mkdtemp(join(process.cwd(), ".tmp", "registry-paths-test-"));
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
    expect(paths.profiles).toBe(join(paths.root, "profiles"));
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
