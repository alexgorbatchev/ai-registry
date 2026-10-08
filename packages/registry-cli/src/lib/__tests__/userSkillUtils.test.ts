import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import {
  getOutputSkillName,
  injectDisableModelInvocation,
  isUserSkillPath,
  parseSkillAuthor,
  readHarnessSkillEntries,
  removeDisableModelInvocation,
  updateSkillName,
} from "../userSkillUtils";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "user-skill-utils-tests");

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  return mkdtemp(join(TEST_ROOT, "case-"));
}

describe("userSkillUtils", () => {
  describe("injectDisableModelInvocation", () => {
    it("injects disable-model-invocation: true into standard frontmatter", () => {
      const source = `---
name: continue-session
description: Resume prior session.
author: alexgorbatchev
---

# Content
`;
      const result = injectDisableModelInvocation(source);
      expect(result).toBe(`---
disable-model-invocation: true
name: continue-session
description: Resume prior session.
author: alexgorbatchev
---

# Content
`);
    });

    it("is idempotent when disable-model-invocation: true is already present", () => {
      const source = `---
disable-model-invocation: true
name: continue-session
---
# Content
`;
      const result = injectDisableModelInvocation(source);
      expect(result).toBe(source);
    });

    it("updates disable-model-invocation: false to true", () => {
      const source = `---
disable-model-invocation: false
name: continue-session
---
# Content
`;
      const result = injectDisableModelInvocation(source);
      expect(result).toBe(`---
disable-model-invocation: true
name: continue-session
---
# Content
`);
    });

    it("handles CRLF newlines correctly", () => {
      const source = "---\r\nname: continue-session\r\n---\r\n# Content\r\n";
      const result = injectDisableModelInvocation(source);
      expect(result).toBe("---\r\ndisable-model-invocation: true\r\nname: continue-session\r\n---\r\n# Content\r\n");
    });

    it("prepends frontmatter if file has no frontmatter", () => {
      const source = "# Just markdown\nNo frontmatter here.\n";
      const result = injectDisableModelInvocation(source);
      expect(result).toBe(`---
disable-model-invocation: true
---
# Just markdown
No frontmatter here.
`);
    });
  });

  describe("removeDisableModelInvocation", () => {
    it("removes disable-model-invocation from frontmatter", () => {
      const source = `---
disable-model-invocation: true
name: continue-session
description: Resume prior session.
---

# Content
`;
      const result = removeDisableModelInvocation(source);
      expect(result).toBe(`---
name: continue-session
description: Resume prior session.
---

# Content
`);
    });

    it("returns source unchanged when disable-model-invocation is not present", () => {
      const source = `---
name: bun
description: Native Bun APIs.
---

# Content
`;
      const result = removeDisableModelInvocation(source);
      expect(result).toBe(source);
    });

    it("handles CRLF newlines when removing", () => {
      const source = "---\r\ndisable-model-invocation: true\r\nname: continue-session\r\n---\r\n# Content\r\n";
      const result = removeDisableModelInvocation(source);
      expect(result).toBe("---\r\nname: continue-session\r\n---\r\n# Content\r\n");
    });

    it("returns non-frontmatter files unchanged", () => {
      const source = "# Just markdown\n";
      const result = removeDisableModelInvocation(source);
      expect(result).toBe(source);
    });
  });

  describe("isUserSkillPath", () => {
    it("identifies paths under skills/user as user skills", () => {
      expect(isUserSkillPath("/repo/skills/user/continue-session")).toBe(true);
      expect(isUserSkillPath("/repo/skills/user/continue-session/SKILL.md")).toBe(true);
      expect(isUserSkillPath("skills/user/continue-session")).toBe(true);
    });

    it("identifies paths under overlay skills/user as user skills", () => {
      expect(isUserSkillPath("/overlay/skills/user/my-tool")).toBe(true);
    });

    it("identifies paths under skills/agent as not user skills", () => {
      expect(isUserSkillPath("/repo/skills/agent/bun")).toBe(false);
      expect(isUserSkillPath("/repo/skills/agent/bun/SKILL.md")).toBe(false);
      expect(isUserSkillPath("skills/agent/bun")).toBe(false);
    });

    it("identifies flat skills as not user skills", () => {
      expect(isUserSkillPath("/repo/skills/bun")).toBe(false);
    });
  });

  describe("readHarnessSkillEntries", () => {
    it("returns empty array when harness skills directory does not exist", async () => {
      const nonExistent = join(TEST_ROOT, "does-not-exist");
      const result = await readHarnessSkillEntries(nonExistent);
      expect(result).toEqual([]);
    });

    it("discovers skills grouped into agent and user directories", async () => {
      const testDir = await createTestDirectory();
      try {
        const skillsDir = join(testDir, "skills");
        await mkdir(join(skillsDir, "agent", "my-agent-skill"), { recursive: true });
        await writeFile(join(skillsDir, "agent", "my-agent-skill", "SKILL.md"), "# Agent");
        await mkdir(join(skillsDir, "user", "my-user-skill"), { recursive: true });
        await writeFile(join(skillsDir, "user", "my-user-skill", "SKILL.md"), "# User");

        const result = await readHarnessSkillEntries(skillsDir);
        expect(result).toEqual([
          {
            name: "my-agent-skill",
            sourcePath: join(skillsDir, "agent", "my-agent-skill"),
            isUser: false,
          },
          {
            name: "my-user-skill",
            sourcePath: join(skillsDir, "user", "my-user-skill"),
            isUser: true,
          },
        ]);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("throws an error when duplicate skill name exists in both agent and user", async () => {
      const testDir = await createTestDirectory();
      try {
        const skillsDir = join(testDir, "skills");
        await mkdir(join(skillsDir, "agent", "duplicate-skill"), { recursive: true });
        await mkdir(join(skillsDir, "user", "duplicate-skill"), { recursive: true });

        await expect(readHarnessSkillEntries(skillsDir)).rejects.toThrow(
          `Duplicate skill name "duplicate-skill" found in both agent and user harness skills directories`,
        );
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("falls back to flat directory structure when no agent/user folders exist", async () => {
      const testDir = await createTestDirectory();
      try {
        const skillsDir = join(testDir, "skills");
        await mkdir(join(skillsDir, "flat-skill"), { recursive: true });
        await writeFile(join(skillsDir, "flat-skill", "SKILL.md"), "# Flat");

        const result = await readHarnessSkillEntries(skillsDir);
        expect(result).toEqual([
          {
            name: "flat-skill",
            sourcePath: join(skillsDir, "flat-skill"),
            isUser: false,
          },
        ]);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe("parseSkillAuthor", () => {
    it("extracts author from standard frontmatter", () => {
      const source = `---
name: triage
author: mattpocock
description: Triage issues.
---
# Content`;
      expect(parseSkillAuthor(source)).toBe("mattpocock");
    });

    it("extracts author with CRLF line endings", () => {
      const source = "---\r\nname: triage\r\nauthor: mattpocock\r\n---\r\n# Content";
      expect(parseSkillAuthor(source)).toBe("mattpocock");
    });

    it("returns null when author is missing or empty", () => {
      expect(parseSkillAuthor("---\nname: triage\n---\n")).toBeNull();
      expect(parseSkillAuthor("---\nauthor:\n---\n")).toBeNull();
      expect(parseSkillAuthor("# No frontmatter")).toBeNull();
    });
  });

  describe("getOutputSkillName", () => {
    it("returns skill name unchanged when author is alexgorbatchev", () => {
      expect(getOutputSkillName("bun", "alexgorbatchev")).toBe("bun");
      expect(getOutputSkillName("git-commit", "alexgorbatchev")).toBe("git-commit");
    });

    it("returns skill name unchanged when author is agorbatchev alias", () => {
      expect(getOutputSkillName("code-review-baseline", "agorbatchev")).toBe("code-review-baseline");
    });

    it("returns skill name unchanged when author is null or empty", () => {
      expect(getOutputSkillName("my-skill", null)).toBe("my-skill");
      expect(getOutputSkillName("my-skill", "")).toBe("my-skill");
      expect(getOutputSkillName("my-skill")).toBe("my-skill");
    });

    it("prefixes non-alexgorbatchev author to skill name", () => {
      expect(getOutputSkillName("triage", "mattpocock")).toBe("mattpocock-triage");
      expect(getOutputSkillName("diagnosing-bugs", "mattpocock")).toBe("mattpocock-diagnosing-bugs");
      expect(getOutputSkillName("to-tickets", "mattpocock")).toBe("mattpocock-to-tickets");
      expect(getOutputSkillName("hunk-review", "modem-dev")).toBe("modem-dev-hunk-review");
      expect(getOutputSkillName("shadcn", "shadcn")).toBe("shadcn-shadcn");
      expect(getOutputSkillName("thermo-nuclear-code-quality-review", "cursor")).toBe(
        "cursor-thermo-nuclear-code-quality-review",
      );
    });

    it("does not double prefix if skill already starts with author prefix", () => {
      expect(getOutputSkillName("mattpocock-triage", "mattpocock")).toBe("mattpocock-triage");
    });
  });

  describe("updateSkillName", () => {
    it("replaces existing name in frontmatter", () => {
      const source = `---
name: triage
author: mattpocock
---
# Content`;
      expect(updateSkillName(source, "mattpocock-triage")).toBe(`---
name: mattpocock-triage
author: mattpocock
---
# Content`);
    });

    it("handles CRLF line endings when updating name", () => {
      const source = "---\r\nname: triage\r\nauthor: mattpocock\r\n---\r\n# Content";
      expect(updateSkillName(source, "mattpocock-triage")).toBe(
        "---\r\nname: mattpocock-triage\r\nauthor: mattpocock\r\n---\r\n# Content",
      );
    });

    it("returns non-frontmatter content unchanged", () => {
      const source = "# Just Content";
      expect(updateSkillName(source, "new-name")).toBe(source);
    });
  });
});
