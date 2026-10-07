import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import {
  ensureSkillAuthor,
  extractAuthorFromSource,
  relocateVendoredSkill,
  resolveVendoredSkillAuthor,
} from "../vendoredSkillUtils";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "vendored-skill-utils-tests");

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  return mkdtemp(join(TEST_ROOT, "case-"));
}

describe("vendoredSkillUtils", () => {
  describe("extractAuthorFromSource", () => {
    it("extracts owner from owner/repo shorthand", () => {
      expect(extractAuthorFromSource("mattpocock/skills")).toBe("mattpocock");
      expect(extractAuthorFromSource("shadcn/ui")).toBe("shadcn");
      expect(extractAuthorFromSource("modem-dev/hunk")).toBe("modem-dev");
    });

    it("extracts owner when skill or ref is attached to source", () => {
      expect(extractAuthorFromSource("mattpocock/skills@triage")).toBe("mattpocock");
      expect(extractAuthorFromSource("mattpocock/skills#v1.0.0")).toBe("mattpocock");
      expect(extractAuthorFromSource("mattpocock/skills@triage#main")).toBe("mattpocock");
    });

    it("extracts owner from https github URLs", () => {
      expect(extractAuthorFromSource("https://github.com/mattpocock/skills")).toBe("mattpocock");
      expect(extractAuthorFromSource("https://github.com/mattpocock/skills.git")).toBe("mattpocock");
      expect(extractAuthorFromSource("https://github.com/mattpocock/skills/tree/main")).toBe("mattpocock");
    });

    it("extracts owner from git SSH URLs", () => {
      expect(extractAuthorFromSource("git@github.com:mattpocock/skills.git")).toBe("mattpocock");
      expect(extractAuthorFromSource("git@gitlab.com:some-user/some-repo.git")).toBe("some-user");
    });

    it("extracts owner from github: prefix", () => {
      expect(extractAuthorFromSource("github:mattpocock/skills")).toBe("mattpocock");
    });

    it("returns null for invalid or empty source strings", () => {
      expect(extractAuthorFromSource("")).toBeNull();
      expect(extractAuthorFromSource("invalid-source")).toBeNull();
    });
  });

  describe("ensureSkillAuthor", () => {
    it("injects author into frontmatter without author", () => {
      const source = `---
name: triage
description: Triage issues.
---

# Content
`;
      const result = ensureSkillAuthor(source, "mattpocock");
      expect(result).toBe(`---
name: triage
description: Triage issues.
author: mattpocock
---

# Content
`);
    });

    it("preserves existing author if already present and different from placeholder", () => {
      const source = `---
name: triage
description: Triage issues.
author: upstream-author
---

# Content
`;
      const result = ensureSkillAuthor(source, "mattpocock");
      expect(result).toBe(source);
    });

    it("replaces alexgorbatchev placeholder with vendored author", () => {
      const source = `---
name: shadcn
description: Shadcn components.
author: alexgorbatchev
---

# Content
`;
      const result = ensureSkillAuthor(source, "shadcn");
      expect(result).toBe(`---
name: shadcn
description: Shadcn components.
author: shadcn
---

# Content
`);
    });

    it("replaces empty author line with vendored author", () => {
      const source = `---
name: triage
description: Triage issues.
author:
---

# Content
`;
      const result = ensureSkillAuthor(source, "mattpocock");
      expect(result).toBe(`---
name: triage
description: Triage issues.
author: mattpocock
---

# Content
`);
    });

    it("handles CRLF line endings properly", () => {
      const source = "---\r\nname: triage\r\ndescription: Triage issues.\r\n---\r\n\r\n# Content\r\n";
      const result = ensureSkillAuthor(source, "mattpocock");
      expect(result).toBe("---\r\nname: triage\r\ndescription: Triage issues.\r\nauthor: mattpocock\r\n---\r\n\r\n# Content\r\n");
    });

    it("creates frontmatter if none exists", () => {
      const source = "# Just Content\n";
      const result = ensureSkillAuthor(source, "mattpocock");
      expect(result).toBe(`---
author: mattpocock
---
# Just Content
`);
    });
  });

  describe("resolveVendoredSkillAuthor", () => {
    it("resolves author from passed source", async () => {
      const root = await createTestDirectory();
      try {
        const author = await resolveVendoredSkillAuthor(root, "triage", "mattpocock/skills");
        expect(author).toBe("mattpocock");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("resolves author from skills-lock.json when source is not passed", async () => {
      const root = await createTestDirectory();
      try {
        await Bun.write(
          join(root, "skills-lock.json"),
          JSON.stringify({
            version: 1,
            skills: {
              triage: { source: "mattpocock/skills" },
            },
          }),
        );
        const author = await resolveVendoredSkillAuthor(root, "triage");
        expect(author).toBe("mattpocock");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("returns null if skill is not in lockfile and no source is provided", async () => {
      const root = await createTestDirectory();
      try {
        const author = await resolveVendoredSkillAuthor(root, "unknown-skill");
        expect(author).toBeNull();
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });

  describe("relocateVendoredSkill", () => {
    it("relocates an agent skill, injects author, and moves to skills/agent", async () => {
      const root = await createTestDirectory();
      try {
        const flatDir = join(root, "skills", "diagnosing-bugs");
        await mkdir(flatDir, { recursive: true });
        await Bun.write(
          join(flatDir, "SKILL.md"),
          `---
name: diagnosing-bugs
description: Diagnose bugs.
---

# Content
`,
        );

        await relocateVendoredSkill(root, "diagnosing-bugs", "mattpocock/skills");

        expect(await Bun.file(join(flatDir, "SKILL.md")).exists()).toBe(false);
        const targetFile = Bun.file(join(root, "skills", "agent", "diagnosing-bugs", "SKILL.md"));
        expect(await targetFile.exists()).toBe(true);
        const content = await targetFile.text();
        expect(content).toContain("author: mattpocock");
        expect(content).not.toContain("disable-model-invocation");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("relocates a user skill, strips disable-model-invocation, injects author, and moves to skills/user", async () => {
      const root = await createTestDirectory();
      try {
        const flatDir = join(root, "skills", "triage");
        await mkdir(flatDir, { recursive: true });
        await Bun.write(
          join(flatDir, "SKILL.md"),
          `---
name: triage
description: Triage issues.
disable-model-invocation: true
---

# Content
`,
        );

        await relocateVendoredSkill(root, "triage", "mattpocock/skills");

        expect(await Bun.file(join(flatDir, "SKILL.md")).exists()).toBe(false);
        const targetFile = Bun.file(join(root, "skills", "user", "triage", "SKILL.md"));
        expect(await targetFile.exists()).toBe(true);
        const content = await targetFile.text();
        expect(content).toContain("author: mattpocock");
        expect(content).not.toContain("disable-model-invocation");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("preserves skills/user placement for existing user skills during update", async () => {
      const root = await createTestDirectory();
      try {
        // Existing user skill
        await mkdir(join(root, "skills", "user", "to-tickets"), { recursive: true });
        await Bun.write(
          join(root, "skills", "user", "to-tickets", "SKILL.md"),
          `---
name: to-tickets
description: Existing user skill.
author: mattpocock
---
`,
        );

        // Updated skill staged in flat skills/
        const flatDir = join(root, "skills", "to-tickets");
        await mkdir(flatDir, { recursive: true });
        await Bun.write(
          join(flatDir, "SKILL.md"),
          `---
name: to-tickets
description: Updated from upstream without disable-model-invocation.
---
`,
        );

        await relocateVendoredSkill(root, "to-tickets", "mattpocock/skills");

        const targetFile = Bun.file(join(root, "skills", "user", "to-tickets", "SKILL.md"));
        expect(await targetFile.exists()).toBe(true);
        const content = await targetFile.text();
        expect(content).toContain("author: mattpocock");
        expect(content).toContain("Updated from upstream");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
