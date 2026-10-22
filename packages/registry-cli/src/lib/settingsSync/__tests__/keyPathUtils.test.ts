import { describe, expect, it } from "bun:test";

import { expandKeyPathPattern, getAtKeyPath, isUnderKeyPathPattern, setAtKeyPath } from "../keyPathUtils";
import type { IJsonObject } from "../types";

describe("keyPathUtils", () => {
  it("expands wildcard segments against the keys present in any of the values", () => {
    const paths = expandKeyPathPattern(
      ["mcp", "*", "headers"],
      [{ mcp: { docs: { url: "x" } } }, { mcp: { search: { headers: {} }, docs: { url: "y" } } }, { other: true }],
    );

    expect(paths).toEqual([
      ["mcp", "docs", "headers"],
      ["mcp", "search", "headers"],
    ]);
  });

  it("returns literal paths unchanged even when the values lack them", () => {
    expect(expandKeyPathPattern(["notice", "seen"], [{}])).toEqual([["notice", "seen"]]);
  });

  it("matches key paths inside a wildcard pattern", () => {
    expect(isUnderKeyPathPattern(["mcp", "docs", "headers", "Authorization"], ["mcp", "*", "headers"])).toBe(true);
    expect(isUnderKeyPathPattern(["mcp", "docs"], ["mcp", "*", "headers"])).toBe(false);
    expect(isUnderKeyPathPattern(["mcp", "docs", "url"], ["mcp", "*", "headers"])).toBe(false);
  });

  it("reads, sets, and removes values at nested key paths", () => {
    const target: IJsonObject = { a: { b: 1 }, scalar: 2 };

    setAtKeyPath(target, ["a", "c"], 3);
    setAtKeyPath(target, ["new", "deep"], true);
    setAtKeyPath(target, ["a", "b"], undefined);
    setAtKeyPath(target, ["missing", "child"], undefined);
    setAtKeyPath(target, [], 4);

    expect(target).toEqual({ a: { c: 3 }, scalar: 2, new: { deep: true } });
    expect(getAtKeyPath(target, ["new", "deep"])).toBe(true);
    expect(getAtKeyPath(target, ["scalar", "child"])).toBeUndefined();
  });
});
