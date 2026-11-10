import { describe, expect, it } from "bun:test";

import type { IJsonObject } from "../types";

import { findOwningLayerIndex, mergeSettingsLayers, routeSettingsChanges } from "../settingsLayerUtils";

describe("mergeSettingsLayers", () => {
  it("merges objects key by key and lets later layers replace other values", () => {
    const publicLayer = { model: "a", list: [1, 2], mcp: { shared: { url: "public" } } };
    const overlayLayer = { list: [3], mcp: { private: { url: "overlay" } } };

    expect(mergeSettingsLayers([publicLayer, overlayLayer])).toEqual({
      model: "a",
      list: [3],
      mcp: { shared: { url: "public" }, private: { url: "overlay" } },
    });
    expect(publicLayer).toEqual({ model: "a", list: [1, 2], mcp: { shared: { url: "public" } } });
  });

  it("replaces an object with a scalar from a later layer", () => {
    expect(mergeSettingsLayers([{ tools: { a: true } }, { tools: false }])).toEqual({ tools: false });
  });

  it("returns an empty object for no layers", () => {
    expect(mergeSettingsLayers([])).toEqual({});
  });
});

describe("findOwningLayerIndex", () => {
  const layers: IJsonObject[] = [
    { model: "a", mcp_servers: { node_repl: { env: { A: "1" } } } },
    { model: "b", mcp_servers: { executor: { url: "x" } } },
  ];

  it("picks the layer defining the longest part of the key path", () => {
    expect(findOwningLayerIndex(layers, ["mcp_servers", "node_repl", "env", "B"])).toBe(0);
    expect(findOwningLayerIndex(layers, ["mcp_servers", "executor", "url"])).toBe(1);
  });

  it("lets the later layer win a tie", () => {
    expect(findOwningLayerIndex(layers, ["model"])).toBe(1);
    expect(findOwningLayerIndex(layers, ["mcp_servers", "added"])).toBe(1);
  });

  it("gives a key no layer defines to the first layer", () => {
    expect(findOwningLayerIndex(layers, ["theme"])).toBe(0);
  });
});

describe("routeSettingsChanges", () => {
  it("sends values to their owners and removals to every layer that defines the key", () => {
    const layers: IJsonObject[] = [
      { model: "a", theme: "dark" },
      { model: "b", mcp: { executor: { url: "x" } } },
    ];

    expect(
      routeSettingsChanges(layers, [
        { keyPath: ["theme"], value: "light" },
        { keyPath: ["mcp", "executor", "url"], value: "y" },
        { keyPath: ["model"], value: undefined },
      ]),
    ).toEqual([
      [
        { keyPath: ["theme"], value: "light" },
        { keyPath: ["model"], value: undefined },
      ],
      [
        { keyPath: ["mcp", "executor", "url"], value: "y" },
        { keyPath: ["model"], value: undefined },
      ],
    ]);
  });
});
