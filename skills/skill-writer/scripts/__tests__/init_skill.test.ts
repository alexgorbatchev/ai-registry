import assert from "node:assert";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { initSkill } from "../init_skill";
import { validateSkill } from "../quick_validate";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
const TMP_DIR = resolve(REPO_ROOT, ".tmp");

function createTempDirectory(): string {
  mkdirSync(TMP_DIR, { recursive: true });

  return mkdtempSync(resolve(TMP_DIR, "skill-writer-"));
}

describe("initSkill", () => {
  it("creates a default skill scaffold that validates cleanly", async () => {
    const tempDir = createTempDirectory();

    try {
      const skillDir = await initSkill("example-skill", tempDir);

      assert(skillDir !== null);

      const validationResult = await validateSkill(skillDir);
      const skillContent = await Bun.file(resolve(skillDir, "SKILL.md")).text();
      const frontmatterMatch = skillContent.match(/^---\n[\s\S]*?\n---/);

      assert(frontmatterMatch);

      expect(validationResult).toEqual({
        valid: true,
        message: "Skill is valid!",
      });
      expect(frontmatterMatch[0]).toBe(`---
name: example-skill
description: "[TODO: Complete and informative explanation of what the skill does and when to use it. Include WHEN to use this skill - specific scenarios, file types, or tasks that trigger it.]"
author: alexgorbatchev
source: "{{file_path}}"
---`);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
