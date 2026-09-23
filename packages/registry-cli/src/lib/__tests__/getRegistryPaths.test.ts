import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

import { getRegistryPaths, resolvePathWithHome } from "../getRegistryPaths";

describe("getRegistryPaths", () => {
  const originalEnv = process.env.AI_REGISTRY_OVERLAY;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(homedir(), ".tmp-registry-paths-test-"));
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env.AI_REGISTRY_OVERLAY;
    } else {
      process.env.AI_REGISTRY_OVERLAY = originalEnv;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns overlay as null when AI_REGISTRY_OVERLAY is not set", () => {
    delete process.env.AI_REGISTRY_OVERLAY;
    const paths = getRegistryPaths();
    expect(paths.overlay).toBeNull();
    expect(paths.skills).toBe(join(paths.root, "skills"));
    expect(paths.commands).toBe(join(paths.root, "commands"));
    expect(paths.profiles).toBe(join(paths.root, "profiles"));
  });

  it("returns overlay as null when AI_REGISTRY_OVERLAY is whitespace", () => {
    process.env.AI_REGISTRY_OVERLAY = "   ";
    const paths = getRegistryPaths();
    expect(paths.overlay).toBeNull();
  });

  it("resolves overlay when AI_REGISTRY_OVERLAY points to an existing absolute path", () => {
    process.env.AI_REGISTRY_OVERLAY = tempDir;
    const paths = getRegistryPaths();
    expect(paths.overlay).toBe(tempDir);
  });

  it("resolves overlay with tilde (~) expansion", () => {
    const relativeToHome = tempDir.slice(homedir().length).replace(/^[/\\]+/, "");
    process.env.AI_REGISTRY_OVERLAY = `~/${relativeToHome}`;
    const paths = getRegistryPaths();
    expect(paths.overlay).toBe(tempDir);
  });

  it("throws an informative error when AI_REGISTRY_OVERLAY points to a non-existent path", () => {
    const nonExistent = join(tempDir, "does-not-exist");
    process.env.AI_REGISTRY_OVERLAY = nonExistent;
    expect(() => getRegistryPaths()).toThrow(/Overlay directory does not exist/);
  });

  it("resolves path with home correctly", () => {
    expect(resolvePathWithHome("~/foo/bar", "/some/root")).toBe(join(homedir(), "foo", "bar"));
    expect(resolvePathWithHome("~", "/some/root")).toBe(homedir());
    expect(resolvePathWithHome("/absolute/path", "/some/root")).toBe("/absolute/path");
    expect(resolvePathWithHome("relative/path", "/some/root")).toBe(join("/some/root", "relative", "path"));
  });
});
