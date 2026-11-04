export type JsonValue = null | boolean | number | string | JsonValue[] | IJsonObject;

export interface IJsonObject {
  [key: string]: JsonValue;
}

// Object keys from the document root. Arrays are compared and replaced as whole values.
export type SettingsKeyPath = string[];

export interface ISettingsConflict {
  keyPath: SettingsKeyPath;
  liveValue: JsonValue | undefined;
  sourceValue: JsonValue | undefined;
  kept: "live" | "source";
}

export interface ISettingsMergeResult {
  liveValue: IJsonObject;
  sourceValue: IJsonObject;
  conflicts: ISettingsConflict[];
}

export interface ISettingsChange {
  keyPath: SettingsKeyPath;
  value: JsonValue | undefined;
}

// A string setting holding a JSON object whose source entries override matching live
// entries, inside a table the harness creates and owns, such as an MCP server a desktop
// app registers. Source entries reach the live file only while that table holds at
// least one of `ownerTableKeys`; otherwise they are removed from the live file, so the
// registry never creates the table by itself.
export interface ISourceJsonObjectSetting {
  keyPath: SettingsKeyPath;
  ownerTableKeyPath: SettingsKeyPath;
  ownerTableKeys: string[];
}

export interface ISyncedSettingsFileOptions {
  // Key path patterns (`*` matches any key) that stay in the live file only and are
  // never written back to the registry source: values the harness stamps on its own
  // (version notices), machine-specific entries (local project paths), and fields
  // that can hold credentials (MCP headers and environment).
  liveOnlyKeyPaths?: SettingsKeyPath[];
  // Applied after live-only preservation.
  sourceJsonObjects?: ISourceJsonObjectSetting[];
}

// "clean": tracked with no uncommitted edits, so a sync edit can be committed on its own.
export type SettingsSourceState = "clean" | "dirty" | "unversioned";

export interface ISettingsSourceRepository {
  getSourceState(sourcePath: string): Promise<SettingsSourceState>;
  // Whether gitleaks finds possible secrets in the file; such changes are never committed.
  hasSecrets(sourcePath: string): Promise<boolean>;
  commit(sourcePaths: string[]): Promise<void>;
}

export interface ISyncedSettingsFile {
  relativePath: string;
  liveOnlyKeyPaths: SettingsKeyPath[];
  sourceJsonObjects?: ISourceJsonObjectSetting[];
}
