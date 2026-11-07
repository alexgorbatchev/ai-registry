import type { Action, PreservedArtifact } from './types';

export type NativeAction = Action & { identity: string };
export type NativeInspection = { path: string; identity: string; bytes: number; hardlinks: string[] };
export type NativeHardlink = { ctimeMs: number; nlink: number; fingerprint: string };
export type NativeHardlinks = { baseline: Map<string, NativeHardlink>; removed: Map<string, number> };
export type NativeScope = { path: string; entries: string[] };
export type NativeManifest = {
  version: 1;
  root: string;
  actions: NativeAction[];
  preserved: PreservedArtifact[];
  scopes: NativeScope[];
  processWarnings: string[];
};
export type NativeReview = { manifestPath: string; manifest: NativeManifest };
export type NativeRemoval = {
  execute: boolean;
  actions: NativeAction[];
  removed: string[];
  preserved: PreservedArtifact[];
  newEntries: string[];
  failure: string | null;
  before: string | null;
  after: string | null;
  logPath: string | null;
  freeBeforeBytes: number | null;
  freeAfterBytes: number | null;
  reclaimedBytes: number | null;
  commands: { args: string[]; exitCode: number; stderr: string }[];
};
export type NativeProcesses = { active: string[]; warnings: string[] };
