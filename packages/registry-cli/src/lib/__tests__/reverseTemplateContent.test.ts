import { describe, expect, it } from "bun:test";
import { reverseTemplateContent, reverseTemplateObject } from "../reverseTemplateContent";
import { renderTemplate } from "@alexgorbatchev/template-resolver";
import type { ITemplateContext } from "../harnessBuild";

describe("reverseTemplateContent", () => {
  const mockContext: ITemplateContext = {
    repo_root: "/path/to/repo",
    skills_dir: "/path/to/repo/skills",
    commands_dir: "/path/to/repo/commands",
    profiles_dir: "/path/to/repo/profiles",
    output_dir: "/path/to/repo/.output",
  };

  it("replaces absolute paths with corresponding template variables", () => {
    const rawContent = '{\n  "plugin": ["file:///path/to/repo/vendor/my-plugin"],\n  "skills": ["/path/to/repo/skills/git"]\n}';
    const processed = reverseTemplateContent(rawContent, mockContext);

    expect(processed).toBe('{\n  "plugin": ["file://<%- repo_root %>/vendor/my-plugin"],\n  "skills": ["<%- skills_dir %>/git"]\n}');
  });

  it("handles both forward and backward slashes for paths", () => {
    const rawContent = `path1 = "/path/to/repo/skills/git"\npath2 = "\\path\\to\\repo\\skills\\git"\n`;
    const processed = reverseTemplateContent(rawContent, mockContext);

    expect(processed).toBe(`path1 = "<%- skills_dir %>/git"\npath2 = "<%- skills_dir %>\\git"\n`);
  });

  it("replaces more specific paths before less specific paths (ordering safety)", () => {
    const rawContent = "repo = \"/path/to/repo\"\nskills = \"/path/to/repo/skills\"\n";
    const processed = reverseTemplateContent(rawContent, mockContext);

    expect(processed).toBe("repo = \"<%- repo_root %>\"\nskills = \"<%- skills_dir %>\"\n");
  });

  it("is a no-op when no absolute paths match template context", () => {
    const rawContent = "approval_policy = \"never\"\nsandbox_mode = \"danger-full-access\"\n";
    const processed = reverseTemplateContent(rawContent, mockContext);

    expect(processed).toBe(rawContent);
  });

  it("recovers nested strings while preserving non-string values", () => {
    expect(reverseTemplateObject({
      paths: ["/path/to/repo/skills/example", null, 7, true],
      nested: { root: "/path/to/repo" },
    }, mockContext)).toEqual({
      paths: ["<%- skills_dir %>/example", null, 7, true],
      nested: { root: "<%- repo_root %>" },
    });
  });

  it("escapes rendered EJS delimiters so recovered source renders the same text", async () => {
    const rendered = "Literal <%- missing %> under /path/to/repo";
    const recovered = reverseTemplateContent(rendered, mockContext);
    expect(recovered).toBe("Literal <%%- missing %> under <%- repo_root %>");
    expect(await renderTemplate({
      content: recovered, sourcePath: "/path/to/repo/skill.md", repositoryRoot: mockContext.repo_root,
      variables: mockContext,
    })).toBe(rendered);
  });
});
