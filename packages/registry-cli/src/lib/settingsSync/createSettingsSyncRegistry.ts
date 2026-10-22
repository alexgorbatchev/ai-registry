import { isAbsolute, relative } from "path";

import type { ISyncedSettingsFile, ISyncedSettingsFileOptions } from "./types";

// Records the generated settings files a harness edits at runtime (`/config`,
// model pickers, MCP installers). They are seeded from the registry source, kept
// out of the generated-output manifest, and reconciled with the source on every
// build instead of being reported as drift.
export interface ISettingsSyncRegistry {
  syncSettingsFile(filePath: string, options?: ISyncedSettingsFileOptions): void;
  getSyncedSettingsFiles(): ISyncedSettingsFile[];
}

export function createSettingsSyncRegistry(rootDir: string): ISettingsSyncRegistry {
  const syncedSettingsFiles = new Map<string, ISyncedSettingsFile>();

  return {
    syncSettingsFile(filePath: string, options: ISyncedSettingsFileOptions = {}): void {
      const relativePath = relative(rootDir, filePath).replaceAll("\\", "/");
      if (relativePath.length === 0 || relativePath.startsWith("..") || isAbsolute(relativePath)) {
        throw new Error(`Synced settings file must be inside the generated output root ${rootDir}: ${filePath}`);
      }

      syncedSettingsFiles.set(relativePath, { relativePath, liveOnlyKeyPaths: options.liveOnlyKeyPaths ?? [] });
    },
    getSyncedSettingsFiles(): ISyncedSettingsFile[] {
      return [...syncedSettingsFiles.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    },
  };
}
