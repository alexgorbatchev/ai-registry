import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import {
  assertMissingClaudeCodeOutputPath,
  assertSupportedClaudeCodeManifest,
} from "../profileOutputRules";

describe("assertSupportedClaudeCodeManifest", () => {
  it("accepts a manifest without tools or permission", () => {
    expect(() =>
      assertSupportedClaudeCodeManifest({ description: "Engineer", skills: ["*"] }, "default"),
    ).not.toThrow();
  });

  it("accepts empty tools and permission records", () => {
    expect(() =>
      assertSupportedClaudeCodeManifest({ permission: {}, tools: {} }, "default"),
    ).not.toThrow();
  });

  it("rejects a manifest that declares tools", () => {
    expect(() => assertSupportedClaudeCodeManifest({ tools: { bash: false } }, "developer")).toThrow(
      'Claude Code harness does not support manifest.tools yet for profile "developer".',
    );
  });

  it("rejects a manifest that declares permission", () => {
    expect(() =>
      assertSupportedClaudeCodeManifest({ permission: { edit: "ask" } }, "designer"),
    ).toThrow('Claude Code harness does not support manifest.permission yet for profile "designer".');
  });
});

describe("assertMissingClaudeCodeOutputPath", () => {
  it("does nothing when the output path is missing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "claude-code-rules-"));
    try {
      expect(() =>
        assertMissingClaudeCodeOutputPath(join(rootDir, "skills", "absent"), "skill absent"),
      ).not.toThrow();
    } finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  it("throws when the output path already exists", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "claude-code-rules-"));
    try {
      await mkdir(join(rootDir, "skills"), { recursive: true });
      const outputPath = join(rootDir, "skills", "present");
      await writeFile(outputPath, "taken", "utf-8");

      expect(() => assertMissingClaudeCodeOutputPath(outputPath, "skill present")).toThrow(
        `Cannot stage skill present because the output path already exists: ${outputPath}`,
      );
    } finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });
});
