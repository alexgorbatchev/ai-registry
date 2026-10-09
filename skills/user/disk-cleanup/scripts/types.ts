export type Dependency = {
  path: string;
  repository: string | null;
  isSymlink: boolean;
  bytes: number;
  latestActivity: number | null;
  eligible: boolean;
  reason: string;
};
export type Workspace = { path: string; repository: string | null };
export type Inventory = { repositories: string[]; dependencies: Workspace[]; workspaces: Workspace[] };
export type Worktree = {
  path: string;
  head: string | null;
  branch: string | null;
  isLocked: boolean;
  isPrunable: boolean;
};
export type WorktreeReport = Worktree & {
  repository: string | null;
  bytes: number | null;
  isRegistered: boolean | null;
  changedEntries: number | null;
  ignoredEntries: number | null;
};
export type InspectionError = { repository: string; message: string };
export type WorktreeInspection = { worktrees: WorktreeReport[]; errors: InspectionError[] };
export type Action = {
  path: string;
  repository: string | null;
  kind: 'dependency' | 'cache' | 'worktree';
  bytes: number;
};
export type RunOptions = { root: string; execute: boolean };
export type DependencyOptions = RunOptions & { days: number };
export type DiskOptions = { root: string; depth: number };
export type TimeMode = 'either' | 'modified' | 'accessed';
export type StaleFolder = {
  path: string;
  bytes: number;
  formattedSize: string;
  latestMtimeMs: number;
  latestAtimeMs: number;
  daysSinceModified: number;
  daysSinceAccessed: number;
};
export type FolderOptions = {
  root: string;
  size: string;
  days: number;
  time: TimeMode;
  depth?: number;
  prune: boolean;
};
