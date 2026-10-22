import { describe, expect, it } from "bun:test";

import { applySettingsChanges } from "../applySettingsChanges";

describe("applySettingsChanges", () => {
  it("edits JSONC in place and keeps comments", () => {
    const text = ["{", "  // shared theme", '  "theme": "dark",', '  "plugin": ["a"]', "}", ""].join("\n");

    const nextText = applySettingsChanges(
      text,
      [
        { keyPath: ["theme"], value: "light" },
        { keyPath: ["plugin"], value: ["a", "b"] },
      ],
      "opencode.jsonc",
    );

    expect(nextText).toBe(
      ["{", "  // shared theme", '  "theme": "light",', '  "plugin": [', '    "a",', '    "b"', "  ]", "}", ""].join("\n"),
    );
  });

  it("inserts new keys in code-point order when the object is already sorted", () => {
    const text = ["{", '  "$schema": "s",', '  "attribution": {},', '  "theme": "dark"', "}", ""].join("\n");

    const nextText = applySettingsChanges(text, [{ keyPath: ["model"], value: "opus" }], "settings.json");

    expect(nextText).toBe(
      ["{", '  "$schema": "s",', '  "attribution": {},', '  "model": "opus",', '  "theme": "dark"', "}", ""].join("\n"),
    );
  });

  it("appends new keys when the object is not sorted", () => {
    const text = ["{", '  "theme": "dark",', '  "attribution": {}', "}", ""].join("\n");

    const nextText = applySettingsChanges(text, [{ keyPath: ["model"], value: "opus" }], "settings.json");

    expect(nextText).toBe(["{", '  "theme": "dark",', '  "attribution": {},', '  "model": "opus"', "}", ""].join("\n"));
  });

  it("creates nested objects and removes keys", () => {
    const text = ["{", '  "theme": "dark",', '  "old": true', "}", ""].join("\n");

    const nextText = applySettingsChanges(
      text,
      [
        { keyPath: ["old"], value: undefined },
        { keyPath: ["env", "A"], value: "1" },
      ],
      "settings.json",
    );

    expect(nextText).toBe(["{", '  "theme": "dark",', '  "env": {', '    "A": "1"', "  }", "}", ""].join("\n"));
  });

  it("returns the text unchanged when there are no changes", () => {
    expect(applySettingsChanges("# keep\nmodel = 'x'\n", [], "config.toml")).toBe("# keep\nmodel = 'x'\n");
  });

  it("edits TOML in place and keeps comments", () => {
    const text = ['# shared defaults', 'model = "gpt-5"', "", "[features]", "# experimental", "goals = true", ""].join("\n");

    const nextText = applySettingsChanges(
      text,
      [
        { keyPath: ["model"], value: "gpt-6" },
        { keyPath: ["features", "goals"], value: undefined },
        { keyPath: ["features", "memory"], value: true },
      ],
      "config.toml",
    );

    expect(nextText).toMatchInlineSnapshot(`
      "# shared defaults
      model = "gpt-6"

      [features]
      # experimental
      memory = true
      "
    `);
  });
});
