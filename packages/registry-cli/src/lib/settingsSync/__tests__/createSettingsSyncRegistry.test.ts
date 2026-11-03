import { describe, expect, it } from "bun:test";
import { join } from "path";

import { createSettingsSyncRegistry } from "../createSettingsSyncRegistry";

describe("createSettingsSyncRegistry", () => {
  it("records synced files relative to the staging root, sorted and de-duplicated", () => {
    const registry = createSettingsSyncRegistry("/staging");

    registry.syncSettingsFile(join("/staging", "pi", "settings.json"), {
      liveOnlyKeyPaths: [["lastChangelogVersion"]],
    });
    registry.syncSettingsFile(join("/staging", "claude-code", "settings.json"));
    registry.syncSettingsFile(join("/staging", "claude-code", "settings.json"));

    expect(registry.getSyncedSettingsFiles()).toEqual([
      { relativePath: "claude-code/settings.json", liveOnlyKeyPaths: [] },
      { relativePath: "pi/settings.json", liveOnlyKeyPaths: [["lastChangelogVersion"]] },
    ]);
  });

  it("rejects files outside the staging root", () => {
    const registry = createSettingsSyncRegistry("/staging");

    expect(() => registry.syncSettingsFile("/elsewhere/settings.json")).toThrow(
      "Synced settings file must be inside the generated output root /staging: /elsewhere/settings.json",
    );
  });
});
