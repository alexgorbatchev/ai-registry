import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

import plugin from "../build";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "pi-build-tests");
const originalArgv: string[] = [...process.argv];
const originalPiCodingAgentDir: string | undefined = process.env.PI_CODING_AGENT_DIR;
const createdDirectories: string[] = [];

async function createOutputDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const outputDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(outputDir);
  return outputDir;
}

async function createPiProfile(outputDir: string, profileName: string): Promise<string> {
  const profileDir = join(outputDir, "pi", profileName);
  await mkdir(profileDir, { recursive: true });
  return profileDir;
}

function getBootstrapTargets(): NonNullable<typeof plugin.getBootstrapTargets> {
  assert(plugin.getBootstrapTargets);
  return plugin.getBootstrapTargets;
}

describe("Pi harness bootstrap targets", () => {
  beforeEach(() => {
    process.argv = ["bun", "scripts/bootstrap.ts"];
    delete process.env.PI_CODING_AGENT_DIR;
  });

  afterEach(async () => {
    process.argv = [...originalArgv];
    process.env.PI_CODING_AGENT_DIR = originalPiCodingAgentDir;

    await rm(TEST_ROOT, { force: true, recursive: true });
    createdDirectories.length = 0;
  });

  it("does not require a default Pi profile when bootstrap did not request Pi linking", async () => {
    const outputDir = await createOutputDirectory();

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([]);
  });

  it("links the explicitly requested Pi profile", async () => {
    const outputDir = await createOutputDirectory();
    const profileDir = await createPiProfile(outputDir, "developer");
    process.argv = ["bun", "scripts/bootstrap.ts", "--pi-profile", "developer"];

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([
      {
        description: "Pi config (developer)",
        sourcePath: profileDir,
        targetPath: join(homedir(), ".pi", "agent"),
      },
    ]);
  });

  it("uses PI_CODING_AGENT_DIR for the explicitly requested Pi profile target", async () => {
    const outputDir = await createOutputDirectory();
    const profileDir = await createPiProfile(outputDir, "designer");
    const targetPath = join(outputDir, "custom-pi-agent");
    process.argv = ["bun", "scripts/bootstrap.ts", "--pi-profile", "designer"];
    process.env.PI_CODING_AGENT_DIR = targetPath;

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([
      {
        description: "Pi config (designer)",
        sourcePath: profileDir,
        targetPath,
      },
    ]);
  });

  it("reports generated Pi profiles when the requested profile is missing", async () => {
    const outputDir = await createOutputDirectory();
    await createPiProfile(outputDir, "designer");
    await createPiProfile(outputDir, "developer");
    process.argv = ["bun", "scripts/bootstrap.ts", "--pi-profile", "removed"];

    await expect(getBootstrapTargets()(outputDir)).rejects.toThrow(
      `Generated Pi profile does not exist: ${join(outputDir, "pi", "removed")}. Available generated Pi profiles: designer, developer.`,
    );
  });
});
