import { describe, expect, it } from "bun:test";

import { parseSkillName } from "../resolveSkillVariant";

describe("parseSkillName", () => {
  it("reads the name from frontmatter without requiring an author", () => {
    expect(parseSkillName("---\nname: example\ndescription: Example\n---\nBody.\n")).toBe("example");
  });

  it("returns null without frontmatter, a usable name, or valid YAML", () => {
    expect(parseSkillName("# No frontmatter\n")).toBeNull();
    expect(parseSkillName("---\ndescription: Example\n---\nBody.\n")).toBeNull();
    expect(parseSkillName("---\nname: 42\n---\nBody.\n")).toBeNull();
    expect(parseSkillName("---\n- a list\n---\nBody.\n")).toBeNull();
    expect(parseSkillName("---\nname: [unclosed\n---\nBody.\n")).toBeNull();
  });
});
