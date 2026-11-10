import { factory_testRoot } from "./fixtures";
import { afterAll, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { applyEntriesTarget } from "../applyEntriesTarget";
import type { IBootstrapTarget } from "../harnessBuild";

const TEST_ROOT = factory_testRoot("apply-entries-target-tests");
const createdDirectories: string[] = [];

type IEntriesTarget = Extract<IBootstrapTarget, { kind: "entries" }>;

async function writeTestFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf-8"));
}

async function createTarget(): Promise<{ target: IEntriesTarget; statePath: string }> {
  await mkdir(TEST_ROOT, { recursive: true });
  const caseDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(caseDir);
  return {
    target: {
      kind: "entries",
      sourcePath: join(caseDir, "output", "claude.json"),
      targetPath: join(caseDir, "home", ".claude.json"),
      description: "MCP servers",
      tables: [["mcpServers"]],
      liveOnlyEntryKeys: ["headers"],
    },
    statePath: join(caseDir, "state", "claude.json.json"),
  };
}

afterAll(async () => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

describe("applyEntriesTarget", () => {
  it("adds declared entries and leaves every other key of the target alone", async () => {
    const { target, statePath } = await createTarget();
    await writeTestFile(target.sourcePath, '{ "mcpServers": { "private": { "url": "x" } } }\n');
    await writeTestFile(
      target.targetPath,
      '{"numStartups":3,"mcpServers":{"local":{"url":"l"}},"projects":{"/a":{}}}\n',
    );

    const result = await applyEntriesTarget(target, statePath);

    expect(result).toEqual({
      added: ["mcpServers.private"],
      updated: [],
      removed: [],
      replacedExternalEdits: [],
      keptExternalEdits: [],
    });
    expect(await readJson(target.targetPath)).toEqual({
      numStartups: 3,
      mcpServers: { local: { url: "l" }, private: { url: "x" } },
      projects: { "/a": {} },
    });
    expect(await readJson(statePath)).toEqual({ mcpServers: { private: { url: "x" } } });
  });

  it("leaves the target untouched when the entries already match", async () => {
    const { target, statePath } = await createTarget();
    const targetText = '{"mcpServers":{"private":{"url":"x"}}}\n';
    await writeTestFile(target.sourcePath, '{ "mcpServers": { "private": { "url": "x" } } }\n');
    await writeTestFile(target.targetPath, targetText);

    expect((await applyEntriesTarget(target, statePath)).added).toEqual([]);
    expect(await readFile(target.targetPath, "utf-8")).toBe(targetText);
  });

  it("creates no target file when the registry declares no entries", async () => {
    const { target, statePath } = await createTarget();
    await writeTestFile(target.sourcePath, '{ "mcpServers": {} }\n');

    await applyEntriesTarget(target, statePath);

    expect(existsSync(target.targetPath)).toBe(false);
  });

  it("updates changed entries, keeps live-only fields, and reports values edited outside the registry", async () => {
    const { target, statePath } = await createTarget();
    await writeTestFile(target.sourcePath, '{ "mcpServers": { "a": { "url": "1" }, "b": { "url": "1" } } }\n');
    await applyEntriesTarget(target, statePath);
    await writeTestFile(
      target.targetPath,
      '{"mcpServers":{"a":{"url":"1","headers":{"X":"secret"}},"b":{"url":"edited"}}}\n',
    );
    await writeTestFile(target.sourcePath, '{ "mcpServers": { "a": { "url": "2" }, "b": { "url": "2" } } }\n');

    const result = await applyEntriesTarget(target, statePath);

    expect(result.updated).toEqual(["mcpServers.a", "mcpServers.b"]);
    expect(result.replacedExternalEdits).toEqual(["mcpServers.b"]);
    expect(await readJson(target.targetPath)).toEqual({
      mcpServers: { a: { url: "2", headers: { X: "secret" } }, b: { url: "2" } },
    });
  });

  it("removes entries the registry stopped declaring unless they changed outside the registry", async () => {
    const { target, statePath } = await createTarget();
    await writeTestFile(target.sourcePath, '{ "mcpServers": { "a": { "url": "1" }, "b": { "url": "1" } } }\n');
    await applyEntriesTarget(target, statePath);
    await writeTestFile(target.targetPath, '{"mcpServers":{"a":{"url":"1"},"b":{"url":"edited"},"local":{}}}\n');
    await writeTestFile(target.sourcePath, '{ "mcpServers": {} }\n');

    const result = await applyEntriesTarget(target, statePath);

    expect(result.removed).toEqual(["mcpServers.a"]);
    expect(result.keptExternalEdits).toEqual(["mcpServers.b"]);
    expect(await readJson(target.targetPath)).toEqual({ mcpServers: { b: { url: "edited" }, local: {} } });
    expect(await readJson(statePath)).toEqual({ mcpServers: {} });

    await writeTestFile(target.targetPath, '{"mcpServers":{"local":{}}}\n');
    expect(await applyEntriesTarget(target, statePath)).toEqual({
      added: [],
      updated: [],
      removed: [],
      replacedExternalEdits: [],
      keptExternalEdits: [],
    });
  });
});
