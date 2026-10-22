import { describe, expect, it } from "bun:test";

import { mergeSettingsValues } from "../mergeSettingsValues";

describe("mergeSettingsValues", () => {
  it("writes a key the harness added into both the live file and the source", () => {
    const result = mergeSettingsValues({
      base: { theme: "dark" },
      live: { theme: "dark", model: "opus" },
      source: { theme: "dark" },
      liveOnlyKeyPaths: [],
    });

    expect(result).toEqual({
      liveValue: { theme: "dark", model: "opus" },
      sourceValue: { theme: "dark", model: "opus" },
      conflicts: [],
    });
  });

  it("takes a value the harness changed when the source left it alone", () => {
    const result = mergeSettingsValues({
      base: { theme: "dark", nested: { level: "low" } },
      live: { theme: "dark", nested: { level: "high" } },
      source: { theme: "dark", nested: { level: "low" } },
      liveOnlyKeyPaths: [],
    });

    expect(result.sourceValue).toEqual({ theme: "dark", nested: { level: "high" } });
    expect(result.liveValue).toEqual({ theme: "dark", nested: { level: "high" } });
  });

  it("removes a key from the source when the harness removed it", () => {
    const result = mergeSettingsValues({
      base: { theme: "dark", model: "opus" },
      live: { theme: "dark" },
      source: { theme: "dark", model: "opus" },
      liveOnlyKeyPaths: [],
    });

    expect(result.sourceValue).toEqual({ theme: "dark" });
  });

  it("applies source changes to the live file while keeping harness-only keys", () => {
    const result = mergeSettingsValues({
      base: { theme: "dark" },
      live: { theme: "dark", model: "opus" },
      source: { theme: "light" },
      liveOnlyKeyPaths: [],
    });

    expect(result.liveValue).toEqual({ theme: "light", model: "opus" });
    expect(result.sourceValue).toEqual({ theme: "light", model: "opus" });
    expect(result.conflicts).toEqual([]);
  });

  it("merges sibling keys that each side changed inside the same object", () => {
    const result = mergeSettingsValues({
      base: { env: { A: "1", B: "1" } },
      live: { env: { A: "2", B: "1" } },
      source: { env: { A: "1", B: "2" } },
      liveOnlyKeyPaths: [],
    });

    expect(result.liveValue).toEqual({ env: { A: "2", B: "2" } });
    expect(result.conflicts).toEqual([]);
  });

  it("keeps both sides' list edits when both changed the same list", () => {
    const result = mergeSettingsValues({
      base: { allow: ["read", "edit"] },
      live: { allow: ["read", "edit", "harness-added"] },
      source: { allow: ["read", "registry-added"] },
      liveOnlyKeyPaths: [],
    });

    expect(result.liveValue).toEqual({ allow: ["read", "registry-added", "harness-added"] });
    expect(result.conflicts).toEqual([]);
  });

  it("drops list items the harness removed even when the source also changed the list", () => {
    const result = mergeSettingsValues({
      base: { allow: ["read", "edit"] },
      live: { allow: ["read"] },
      source: { allow: ["read", "edit", "write"] },
      liveOnlyKeyPaths: [],
    });

    expect(result.liveValue).toEqual({ allow: ["read", "write"] });
  });

  it("keeps the source value and reports a conflict when both sides changed the same value", () => {
    const result = mergeSettingsValues({
      base: { theme: "dark" },
      live: { theme: "light" },
      source: { theme: "solarized" },
      liveOnlyKeyPaths: [],
    });

    expect(result).toEqual({
      liveValue: { theme: "solarized" },
      sourceValue: { theme: "solarized" },
      conflicts: [{ keyPath: ["theme"], liveValue: "light", sourceValue: "solarized", kept: "source" }],
    });
  });

  it("reports a conflict when the source removed a value the harness changed", () => {
    const result = mergeSettingsValues({
      base: { theme: "dark" },
      live: { theme: "light" },
      source: {},
      liveOnlyKeyPaths: [],
    });

    expect(result.liveValue).toEqual({});
    expect(result.conflicts).toEqual([
      { keyPath: ["theme"], liveValue: "light", sourceValue: undefined, kept: "source" },
    ]);
  });

  it("combines both sides without a base and keeps the harness value on disagreement", () => {
    const result = mergeSettingsValues({
      base: undefined,
      live: { theme: "light", model: "opus", hooks: ["harness"] },
      source: { theme: "dark", schema: "v1", hooks: ["registry"] },
      liveOnlyKeyPaths: [],
    });

    expect(result).toEqual({
      liveValue: { theme: "light", schema: "v1", hooks: ["registry", "harness"], model: "opus" },
      sourceValue: { theme: "light", schema: "v1", hooks: ["registry", "harness"], model: "opus" },
      conflicts: [{ keyPath: ["theme"], liveValue: "light", sourceValue: "dark", kept: "live" }],
    });
  });

  it("keeps live-only keys in the live file and out of the source", () => {
    const result = mergeSettingsValues({
      base: { theme: "dark", lastChangelogVersion: "1.0.0" },
      live: { theme: "dark", lastChangelogVersion: "1.2.0" },
      source: { theme: "dark" },
      liveOnlyKeyPaths: [["lastChangelogVersion"]],
    });

    expect(result).toEqual({
      liveValue: { theme: "dark", lastChangelogVersion: "1.2.0" },
      sourceValue: { theme: "dark" },
      conflicts: [],
    });
  });

  it("seeds a live-only key from the source when the harness has not written it", () => {
    const result = mergeSettingsValues({
      base: { theme: "dark" },
      live: { theme: "dark" },
      source: { theme: "dark", ui: { lastSeen: "0.1.0" } },
      liveOnlyKeyPaths: [["ui", "lastSeen"]],
    });

    expect(result.liveValue).toEqual({ theme: "dark", ui: { lastSeen: "0.1.0" } });
    expect(result.sourceValue).toEqual({ theme: "dark", ui: { lastSeen: "0.1.0" } });
  });

  it("keeps a nested live-only key when the source removed its parent object", () => {
    const result = mergeSettingsValues({
      base: { ui: { lastSeen: "1.0.0" } },
      live: { ui: { lastSeen: "1.2.0" } },
      source: {},
      liveOnlyKeyPaths: [["ui", "lastSeen"]],
    });

    expect(result).toEqual({
      liveValue: { ui: { lastSeen: "1.2.0" } },
      sourceValue: {},
      conflicts: [{ keyPath: ["ui"], liveValue: { lastSeen: "1.2.0" }, sourceValue: undefined, kept: "source" }],
    });
  });

  it("keeps wildcard live-only fields such as credentials out of the source", () => {
    const result = mergeSettingsValues({
      base: { mcp: {} },
      live: { mcp: { docs: { url: "https://docs.example", headers: { Authorization: "Bearer secret" } } } },
      source: { mcp: {} },
      liveOnlyKeyPaths: [["mcp", "*", "headers"]],
    });

    expect(result).toEqual({
      liveValue: { mcp: { docs: { url: "https://docs.example", headers: { Authorization: "Bearer secret" } } } },
      sourceValue: { mcp: { docs: { url: "https://docs.example" } } },
      conflicts: [],
    });
  });

  it("does not report conflicts under live-only keys", () => {
    const result = mergeSettingsValues({
      base: { lastChangelogVersion: "1.0.0" },
      live: { lastChangelogVersion: "1.2.0" },
      source: { lastChangelogVersion: "1.1.0" },
      liveOnlyKeyPaths: [["lastChangelogVersion"]],
    });

    expect(result).toEqual({
      liveValue: { lastChangelogVersion: "1.2.0" },
      sourceValue: { lastChangelogVersion: "1.1.0" },
      conflicts: [],
    });
  });
});
