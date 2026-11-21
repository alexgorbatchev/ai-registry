import { describe, expect, it } from "bun:test";

import { getCommandSkillName } from "../getCommandSkillName";

describe("getCommandSkillName", () => {
  it("derives a namespaced skill name while preserving command metadata", () => {
    expect(
      getCommandSkillName("--workflow--verify-fix.md", "---\ndescription: Verify a fix\n---\nRun tests.\n", "Codex"),
    ).toBe("command-workflow-verify-fix");
    expect(
      getCommandSkillName("--default-local.md", "---\ndescription: Local workflow\n---\nExecute it.\n", "Codex"),
    ).toBe("command-default-local");
  });

  it("honors an explicit native skill name", () => {
    expect(
      getCommandSkillName(
        "--history.md",
        "---\nname: repo-history\ndescription: |\n  Review history\n---\nInspect commits.\n",
        "Codex",
      ),
    ).toBe("repo-history");
  });

  it.each([
    "No frontmatter.\n",
    "---\ndescription: Missing closing delimiter\n",
    "---\nname: review\n---\nReview.\n",
    "---\ndescription: '  '\n---\nReview.\n",
    "---\ndescription: 12\n---\nReview.\n",
    "---\n- description\n---\nReview.\n",
  ])("rejects commands a harness cannot load as skills: %s", (content) => {
    expect(() => getCommandSkillName("review.md", content, "Codex")).toThrow(
      "Codex command review.md requires YAML frontmatter with a non-empty description.",
    );
  });

  it.each(["../escape", "UPPERCASE", "a".repeat(65), "", "two--hyphens"])(
    "rejects unsafe or invalid explicit names: %s",
    (name) => {
      expect(() =>
        getCommandSkillName("review.md", `---\nname: ${JSON.stringify(name)}\ndescription: Review\n---\n`, "Codex"),
      ).toThrow(
        "Invalid Codex command skill name for review.md: use 1-64 lowercase letters, digits, and single hyphens.",
      );
    },
  );

  it("rejects invalid YAML and non-Markdown command filenames", () => {
    expect(() => getCommandSkillName("review.md", "---\ndescription: [broken\n---\n", "Codex")).toThrow();
    expect(() => getCommandSkillName("review.txt", "---\ndescription: Review\n---\n", "Codex")).toThrow(
      "Codex commands must use .md filenames: review.txt",
    );
    expect(() => getCommandSkillName("review.md", "---\nname: 123\ndescription: Review\n---\n", "Codex")).toThrow(
      "Invalid Codex command skill name for review.md: use 1-64 lowercase letters, digits, and single hyphens.",
    );
  });
});
