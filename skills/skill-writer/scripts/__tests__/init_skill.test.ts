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
description: "[TODO: Describe the capability and the kinds of requests that should trigger this skill in 1-2 sentences. Keep this limited to trigger metadata; do not include workflow rules, operational requirements, or step-by-step instructions.]"
author: alexgorbatchev
---`);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("rejects source in skill frontmatter", async () => {
    const tempDir = createTempDirectory();
    const skillDir = resolve(tempDir, "sourceful-skill");

    try {
      mkdirSync(skillDir, { recursive: true });
      await Bun.write(
        resolve(skillDir, "SKILL.md"),
        `---
name: sourceful-skill
description: Reject legacy source metadata in skill frontmatter.
author: alexgorbatchev
source: "{{file_path}}"
---

# Sourceful Skill
`,
      );

      const validationResult = await validateSkill(skillDir);

      expect(validationResult).toEqual({
        valid: false,
        message:
          "Unexpected key(s) in SKILL.md frontmatter: source. Allowed properties are: allowed-tools, author, description, license, metadata, name",
      });
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
