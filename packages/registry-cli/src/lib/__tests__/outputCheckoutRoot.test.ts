import { factory_testDirectory } from "./fixtures";
import { describe, expect, it } from "bun:test";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { IGeneratedOutputManifest } from "../generatedOutputUtils";
import {
  isOutputRenderedFor,
  isSameCheckoutRoot,
  isSettingsStateFor,
  recordSettingsStateRoot,
} from "../outputCheckoutRoot";

function manifest(fields: Partial<IGeneratedOutputManifest>): IGeneratedOutputManifest {
  return { version: 2, generatedAt: "2026-01-01T00:00:00.000Z", entries: {}, ...fields };
}

describe("isOutputRenderedFor", () => {
  const root = "/checkouts/worktree";
  const current = new Map([
    ["codex/AGENTS.md", "/checkouts/worktree/system/system.md"],
    ["codex/skills/private/SKILL.md", "/overlays/private/skills/private/SKILL.md"],
  ]);

  it("compares a recorded root", () => {
    expect(isOutputRenderedFor(manifest({ root }), root, current)).toBe(true);
    expect(isOutputRenderedFor(manifest({ root: "/checkouts/primary" }), root, current)).toBe(false);
  });

  it("judges a manifest without a root by the registry source paths it recorded", () => {
    const own = { "codex/AGENTS.md": "/checkouts/worktree/system/system.md" };
    const copied = {
      "codex/AGENTS.md": "/checkouts/primary/system/system.md",
      "codex/skills/private/SKILL.md": "/overlays/private/skills/private/SKILL.md",
    };
    expect(isOutputRenderedFor(manifest({ sourcePaths: own }), root, current)).toBe(true);
    // The overlay source is the same in every checkout and proves nothing.
    expect(isOutputRenderedFor(manifest({ sourcePaths: copied }), root, current)).toBe(false);
  });

  it("cannot tell without a root or a comparable registry source", () => {
    expect(isOutputRenderedFor(manifest({}), root, current)).toBeUndefined();
    const overlayOnly = { "codex/skills/private/SKILL.md": "/overlays/private/skills/private/SKILL.md" };
    expect(isOutputRenderedFor(manifest({ sourcePaths: overlayOnly }), root, current)).toBeUndefined();
  });
});

describe("checkout roots on disk", () => {
  it("treats a symbolic link to a checkout as the same root", async () => {
    const dir = factory_testDirectory("checkout-root");
    const checkout = join(dir, "checkout");
    await mkdir(checkout);
    await symlink(checkout, join(dir, "link"));
    expect(isSameCheckoutRoot(join(dir, "link"), checkout)).toBe(true);
    expect(isSameCheckoutRoot(join(dir, "missing"), checkout)).toBe(false);
  });

  it("records the settings-state root and reads it back", async () => {
    const stateDir = factory_testDirectory("settings-state");
    expect(await isSettingsStateFor(stateDir, "/checkouts/worktree")).toBeUndefined();
    await recordSettingsStateRoot(stateDir, "/checkouts/primary");
    expect(await isSettingsStateFor(stateDir, "/checkouts/primary")).toBe(true);
    expect(await isSettingsStateFor(stateDir, "/checkouts/worktree")).toBe(false);
    await writeFile(join(stateDir, "checkout-root.json"), "[]\n");
    expect(await isSettingsStateFor(stateDir, "/checkouts/primary")).toBe(false);
  });
});
