import { describe, expect, it } from "bun:test";
import { parse } from "smol-toml";

import { mergeCodexConfig } from "../mergeCodexConfig";

describe("mergeCodexConfig", () => {
  it("replaces arrays and scalar/table conflicts while retaining unrelated nested values", () => {
    const result = mergeCodexConfig(
      'list = ["local"]\nscalar = { old = true }\ntable = false\n[nested]\nlocal = true\nvalue = 1\n',
      'list = []\nscalar = false\ntable = { new = true }\n[nested]\nvalue = 2\n',
    );
    expect(parse(result)).toEqual({
      list: [], scalar: false, table: { new: true }, nested: { local: true, value: 2 },
    });
  });

  it("replaces arrays of tables rather than concatenating them", () => {
    const result = mergeCodexConfig('[[servers]]\nname = "local"\n', '[[servers]]\nname = "registry"\n');
    expect(parse(result)).toEqual({ servers: [{ name: "registry" }] });
  });

  it("preserves integer precision, float types, and date/time values", () => {
    const existing = 'large = 9223372036854775807\nfloat = 1.0\ndate = 2026-10-13\ntime = 12:34:56\n';
    const result = mergeCodexConfig(existing, 'enabled = true\n');
    expect(parse(result, { integersAsBigInt: true })).toEqual({
      ...parse(existing, { integersAsBigInt: true }), enabled: true,
    });
  });

  it("keeps comments and formatting when the merged values are unchanged", () => {
    const existing = '# Local comment\nmodel="registry"\n[features]\nlocal = true\n';
    expect(mergeCodexConfig(existing, 'model = "registry"\n')).toBe(existing);
    const merged = mergeCodexConfig(existing, 'model = "next"\n');
    expect(mergeCodexConfig(merged, 'model = "next"\n')).toBe(merged);
  });

  it("rejects malformed input from either config", () => {
    expect(() => mergeCodexConfig('broken = [', 'model = "registry"')).toThrow();
    expect(() => mergeCodexConfig('model = "local"', 'broken = [')).toThrow();
  });

  it("treats prototype-related keys as data", () => {
    const result = mergeCodexConfig('[__proto__]\nlocal = true\n', '[__proto__]\nregistry = true\n');
    expect(parse(result)).toEqual(parse('[__proto__]\nlocal = true\nregistry = true\n'));
    expect(Object.hasOwn(Object.prototype, "registry")).toBe(false);
  });
});
