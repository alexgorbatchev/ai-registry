import { describe, expect, it } from "bun:test";

import { listSettingsChanges } from "../listSettingsChanges";

describe("listSettingsChanges", () => {
  it("returns no changes for equal settings", () => {
    expect(listSettingsChanges({ hooks: { Stop: [{ command: "x" }] } }, { hooks: { Stop: [{ command: "x" }] } })).toEqual(
      [],
    );
  });

  it("reports added, changed, and removed keys at the deepest object level", () => {
    const changes = listSettingsChanges(
      { theme: "dark", env: { A: "1", B: "1" }, old: true },
      { theme: "dark", env: { A: "2", B: "1" }, model: "opus" },
    );

    expect(changes).toEqual([
      { keyPath: ["env", "A"], value: "2" },
      { keyPath: ["old"], value: undefined },
      { keyPath: ["model"], value: "opus" },
    ]);
  });

  it("replaces lists and type changes as whole values", () => {
    const changes = listSettingsChanges({ allow: ["read"], mode: { strict: true } }, { allow: ["read", "edit"], mode: "loose" });

    expect(changes).toEqual([
      { keyPath: ["allow"], value: ["read", "edit"] },
      { keyPath: ["mode"], value: "loose" },
    ]);
  });
});
