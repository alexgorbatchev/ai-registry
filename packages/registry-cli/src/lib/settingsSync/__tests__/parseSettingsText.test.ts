import { describe, expect, it } from "bun:test";

import { parseSettingsText } from "../parseSettingsText";

describe("parseSettingsText", () => {
  it("parses JSONC with comments and trailing commas", () => {
    expect(parseSettingsText('{\n  // note\n  "theme": "dark",\n}\n', "settings.json")).toEqual({ theme: "dark" });
  });

  it("names the file and offset when the text is invalid", () => {
    expect(() => parseSettingsText('{ "theme": }', "/live/settings.json")).toThrow(
      "Cannot sync settings file /live/settings.json: ValueExpected at offset 11.",
    );
  });

  it("parses TOML into plain objects for .toml files", () => {
    const settings = parseSettingsText('model = "gpt-5"\n\n[mcp_servers.docs]\nenv = { TOKEN = "x" }\n', "/live/config.toml");

    expect(settings).toEqual({ model: "gpt-5", mcp_servers: { docs: { env: { TOKEN: "x" } } } });
    expect(Object.getPrototypeOf(settings)).toBe(Object.prototype);
  });

  it("names the file when TOML is invalid", () => {
    expect(() => parseSettingsText("model = \n", "/live/config.toml")).toThrowErrorMatchingInlineSnapshot(`
      "Cannot sync settings file /live/config.toml: Error parsing TOML (1, 1):
      model = 
      ^
      Expected value, reached EOF"
    `);
  });

  it("rejects TOML values JSON cannot represent", () => {
    expect(() => parseSettingsText("seen = 2024-01-15\n", "/live/config.toml")).toThrow(
      "Cannot sync settings file /live/config.toml: it contains values JSON cannot represent, such as dates or integers beyond 2^53.",
    );
  });

  it("rejects documents whose root is not an object", () => {
    expect(() => parseSettingsText("[]", "/live/settings.json")).toThrow(
      "Cannot sync settings file /live/settings.json: the document root must be an object.",
    );
  });
});
