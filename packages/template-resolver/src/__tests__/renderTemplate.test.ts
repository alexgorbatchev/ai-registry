import { expect, test } from "bun:test";
import { renderTemplate } from "../index";

test("executes EJS control flow and preserves raw configuration values", async () => {
  expect(await renderTemplate({
    content: '<% for (const part of [repo_root, env("VALUE"), env("ABSENT", "fallback")]) { %><%- part %>\n<% } %>',
    sourcePath: "/repo/prompt.md",
    repositoryRoot: "/repo",
    variables: { repo_root: "/repo/a&b" },
    environment: { VALUE: '<config "value">' },
  })).toBe('/repo/a&b\n<config "value">\nfallback\n');
});

test("uses native EJS escaping and leaves foreign templates alone", async () => {
  expect(await renderTemplate({
    content: '<%= value %> <%%- value %> {{args}} ${{ secrets.TOKEN }} {{.Version}}',
    sourcePath: "/repo/prompt.md",
    repositoryRoot: "/repo",
    variables: { value: "<&>" },
  })).toBe('&lt;&amp;&gt; <%- value %> {{args}} ${{ secrets.TOKEN }} {{.Version}}');
});

test("reports undefined EJS variables", async () => {
  await expect(renderTemplate({
    content: '<%- missing %>', sourcePath: "/repo/prompt.md", repositoryRoot: "/repo", variables: {},
  })).rejects.toThrow("missing is not defined");
});

test("reports missing environment values", async () => {
  await expect(renderTemplate({
    content: '<%- env("MISSING") %>', sourcePath: "/repo/prompt.md", repositoryRoot: "/repo", variables: {},
  })).rejects.toThrow("Missing environment variable: MISSING");
});
