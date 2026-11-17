import { describe, expect, it } from "bun:test";

import type { IJsonObject, ISettingsLayerTraits } from "../types";

import { findOwningLayerIndex, mergeSettingsLayers, routeSettingsChanges } from "../settingsLayerUtils";

// Layer traits for registry (`false`) and tool (`true`) layers, in layer order.
function tools(...isTool: boolean[]): ISettingsLayerTraits[] {
  return isTool.map((value) => ({ isTool: value }));
}

describe("mergeSettingsLayers", () => {
  it("merges objects key by key, appends lists, and lets later layers replace other values", () => {
    const publicLayer = { model: "a", list: [1, 2], mcp: { shared: { url: "public" } } };
    const overlayLayer = { model: "b", list: [3], mcp: { private: { url: "overlay" } } };

    expect(mergeSettingsLayers([publicLayer, overlayLayer])).toEqual({
      model: "b",
      list: [1, 2, 3],
      mcp: { shared: { url: "public" }, private: { url: "overlay" } },
    });
    expect(publicLayer).toEqual({ model: "a", list: [1, 2], mcp: { shared: { url: "public" } } });
  });

  it("appends hook entries of the same event instead of replacing them", () => {
    const guard = { matcher: "Bash", hooks: [{ type: "command", command: "guard" }] };
    const toolHook = { hooks: [{ type: "command", command: "tool" }] };

    expect(
      mergeSettingsLayers([
        { hooks: { PreToolUse: [guard], Stop: [toolHook] } },
        { hooks: { PreToolUse: [toolHook], SessionStart: [toolHook] } },
      ]),
    ).toEqual({ hooks: { PreToolUse: [guard, toolHook], Stop: [toolHook], SessionStart: [toolHook] } });
  });

  it("keeps one copy of an item several layers hold", () => {
    expect(mergeSettingsLayers([{ list: [{ a: 1 }, 2] }, { list: [2, { a: 1 }, 3] }])).toEqual({
      list: [{ a: 1 }, 2, 3],
    });
  });

  it("replaces a list with a value of another type", () => {
    expect(mergeSettingsLayers([{ list: [1] }, { list: "none" }])).toEqual({ list: "none" });
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

  it("lets a registry layer win a tie against a tool layer", () => {
    const withTool: IJsonObject[] = [{ hooks: { Stop: [] } }, { hooks: { SessionStart: [] } }];

    expect(findOwningLayerIndex(withTool, ["hooks", "Notification"], tools(false, true))).toBe(0);
    expect(
      findOwningLayerIndex([{ hooks: {} }, { hooks: {} }, { hooks: {} }], ["hooks", "x"], tools(false, true, false)),
    ).toBe(2);
  });

  it("gives a tool layer edits inside what only it defines", () => {
    const withTool: IJsonObject[] = [{ mcpServers: { shared: {} } }, { mcpServers: { tool: { command: "t" } } }];

    expect(findOwningLayerIndex(withTool, ["mcpServers", "tool", "env"], tools(false, true))).toBe(1);
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

describe("routeSettingsChanges for lists", () => {
  it("removes items from the layers that contributed them and adds new items to the last overlay", () => {
    const layers: IJsonObject[] = [{ allow: ["a", "b"] }, { allow: ["t"] }, { allow: ["p"] }];

    expect(
      routeSettingsChanges(layers, [{ keyPath: ["allow"], value: ["a", "t", "new"] }], tools(false, true, false)),
    ).toEqual([[{ keyPath: ["allow"], value: ["a"] }], [], [{ keyPath: ["allow"], value: ["new"] }]]);
  });

  it("never adds new items to a tool layer", () => {
    const layers: IJsonObject[] = [{ hooks: {} }, { hooks: { SessionStart: ["tool"] } }];

    expect(
      routeSettingsChanges(
        layers,
        [{ keyPath: ["hooks", "SessionStart"], value: ["tool", "user"] }],
        tools(false, true),
      ),
    ).toEqual([[{ keyPath: ["hooks", "SessionStart"], value: ["user"] }], []]);
  });

  it("removes the key from a layer left without items but keeps the owner's emptied list", () => {
    const layers: IJsonObject[] = [{ allow: ["a"] }, { allow: ["t"] }];

    expect(routeSettingsChanges(layers, [{ keyPath: ["allow"], value: [] }], tools(false, true))).toEqual([
      [{ keyPath: ["allow"], value: [] }],
      [{ keyPath: ["allow"], value: undefined }],
    ]);
  });

  it("keeps each layer's items in the list's new order", () => {
    expect(routeSettingsChanges([{ allow: ["a", "b"] }], [{ keyPath: ["allow"], value: ["b", "a"] }])).toEqual([
      [{ keyPath: ["allow"], value: ["b", "a"] }],
    ]);
  });

  it("uses the last layer when only tool layers exist", () => {
    expect(routeSettingsChanges([{ allow: ["t"] }], [{ keyPath: ["allow"], value: ["t", "u"] }], tools(true))).toEqual([
      [{ keyPath: ["allow"], value: ["t", "u"] }],
    ]);
  });

  it("routes a list whole when a layer defines another type at its key", () => {
    const layers: IJsonObject[] = [{ allow: ["a"] }, { allow: "all" }];

    expect(routeSettingsChanges(layers, [{ keyPath: ["allow"], value: ["b"] }])).toEqual([
      [],
      [{ keyPath: ["allow"], value: ["b"] }],
    ]);
  });
});

describe("routeSettingsChanges with owned markers", () => {
  const traits: ISettingsLayerTraits[] = [{}, { isTool: true, ownedMarkers: [".example-tool/"] }];

  it("sends list items carrying a tool's marker to that tool and keeps other additions in the registry", () => {
    const layers: IJsonObject[] = [{ hooks: { Stop: ["guard"] } }, { hooks: { Stop: ["/h/.example-tool/hook stop"] } }];

    expect(
      routeSettingsChanges(
        layers,
        [{ keyPath: ["hooks", "Stop"], value: ["guard", "/h/.example-tool/hook stop v2", "user"] }],
        traits,
      ),
    ).toEqual([
      [{ keyPath: ["hooks", "Stop"], value: ["guard", "user"] }],
      [{ keyPath: ["hooks", "Stop"], value: ["/h/.example-tool/hook stop v2"] }],
    ]);
  });

  it("sends a new list the tool wrote under a new key to the tool", () => {
    expect(
      routeSettingsChanges([{ hooks: {} }, {}], [{ keyPath: ["hooks", "New"], value: ["/h/.example-tool/x"] }], traits),
    ).toEqual([[], [{ keyPath: ["hooks", "New"], value: ["/h/.example-tool/x"] }]]);
  });

  it("sends a changed value carrying a tool's marker to that tool", () => {
    expect(
      routeSettingsChanges(
        [{ statusLine: "a" }, {}],
        [{ keyPath: ["statusLine"], value: "/h/.example-tool/s" }],
        traits,
      ),
    ).toEqual([[], [{ keyPath: ["statusLine"], value: "/h/.example-tool/s" }]]);
  });
});
