import { expect, test } from "bun:test";
import { readCssRules, rootTokens } from "../lib/css";

test("reads rules inside at-rules with declaration line numbers", () => {
  const css =
    ':root {\n  --font: "A;B", monospace;\n}\n/* main { max-width: 1px } */\n@media (max-width: 900px) {\n  :root { --key-h: 2rem }\n  .step { grid-template-columns: 1fr }\n}\n';
  const rules = readCssRules(css, 10);
  expect(rules.map((rule) => [rule.selector, rule.atRules, rule.line])).toEqual([
    [":root", [], 10],
    [":root", ["@media (max-width: 900px)"], 15],
    [".step", ["@media (max-width: 900px)"], 16],
  ]);
  expect(rules[0].declarations).toEqual([{ property: "--font", value: '"A;B", monospace', line: 11 }]);
  expect(rootTokens(rules)).toEqual(new Set(["--font"]));
});

test("reads a style attribute wrapped in braces", () => {
  const [rule] = readCssRules("{font:12px system-ui;max-width:2px}", 7);
  expect(rule.selector).toBe("");
  expect(rule.declarations.map((declaration) => [declaration.property, declaration.value, declaration.line])).toEqual([
    ["font", "12px system-ui", 7],
    ["max-width", "2px", 7],
  ]);
});
