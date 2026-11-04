import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "fs/promises";
import { delimiter, dirname, join } from "path";

import { discoverTrustedProjects } from "../discoverTrustedProjects";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "discover-trusted-projects-tests");

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  return mkdtemp(join(TEST_ROOT, "case-"));
}

async function writeTestFile(rootDir: string, relativePath: string, content: string): Promise<void> {
  const filePath = join(rootDir, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

async function createRepository(rootDir: string, relativePath: string): Promise<void> {
  await mkdir(join(rootDir, relativePath, ".git"), { recursive: true });
}

describe("discoverTrustedProjects", () => {
  afterEach(async () => {
    mock.restore();
    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("finds checkouts beneath a listed folder and the submodules each declares", async () => {
    const root = await createTestDirectory();
    await createRepository(root, "tools/app");
    await createRepository(root, "workspace");
    await writeTestFile(
      root,
      "workspace/.gitmodules",
      [
        '[submodule "repos/lib"]',
        "\tpath = repos/lib",
        "\turl = https://example.invalid/lib.git",
        '[submodule "repos/missing"]',
        "\tpath = repos/missing",
      ].join("\n"),
    );
    await writeTestFile(root, "workspace/repos/lib/.git", "gitdir: ../../.git/modules/repos/lib\n");
    await writeTestFile(root, "workspace/repos/lib/.gitmodules", '[submodule "nested"]\n\tpath = nested\n');
    await createRepository(root, "workspace/repos/lib/nested");
    // Inside a checkout only declared submodules are searched.
    await createRepository(root, "workspace/scratch/undeclared");

    expect(await discoverTrustedProjects(root, root)).toEqual([
      join(root, "tools/app"),
      join(root, "workspace"),
      join(root, "workspace/repos/lib"),
      join(root, "workspace/repos/lib/nested"),
    ]);
  });

  it("skips hidden folders, node_modules, and symlinked folders outside checkouts", async () => {
    const root = await createTestDirectory();
    await createRepository(root, "projects/app");
    await createRepository(root, ".cache/app");
    await createRepository(root, "node_modules/package");
    await symlink(join(root, "projects"), join(root, "linked-projects"));

    expect(await discoverTrustedProjects(root, root)).toEqual([join(root, "projects/app")]);
  });

  it("merges every listed folder, resolving registry-relative paths and dropping duplicates", async () => {
    const root = await createTestDirectory();
    await createRepository(root, "first/app");
    await createRepository(root, "second/app");
    const listed = [join(root, "first"), "", "second", join(root, "first")].join(delimiter);

    expect(await discoverTrustedProjects(listed, root)).toEqual([join(root, "first/app"), join(root, "second/app")]);
  });

  it("warns about and skips a listed folder that does not exist", async () => {
    const root = await createTestDirectory();
    const warnings: string[] = [];
    spyOn(console, "warn").mockImplementation((message: unknown) => {
      warnings.push(String(message));
    });

    expect(await discoverTrustedProjects(join(root, "missing"), root)).toEqual([]);
    expect(warnings).toEqual([
      `⚠️ Trusted Codex folder does not exist: ${join(root, "missing")} (from AI_REGISTRY_CODEX_TRUSTED_DIRS)`,
    ]);
  });

  it("skips folders it cannot read", async () => {
    const root = await createTestDirectory();
    await createRepository(root, "readable/app");
    await mkdir(join(root, "locked"), { recursive: true });
    await chmod(join(root, "locked"), 0o000);
    try {
      expect(await discoverTrustedProjects(root, root)).toEqual([join(root, "readable/app")]);
    } finally {
      await chmod(join(root, "locked"), 0o755);
    }
  });

  it("returns nothing when no folders are listed", async () => {
    expect(await discoverTrustedProjects("", "/repo")).toEqual([]);
  });
});
