export type Dependency = {
  path: string;
  repository: string | null;
  isSymlink: boolean | null;
  bytes: number | null;
  latestActivity: number | null;
  eligible: boolean;
  reason: string;
};
export type Workspace = { path: string; repository: string | null };
export type Inventory = {
  repositories: string[];
  dependencies: Workspace[];
  workspaces: Workspace[];
  errors: InspectionError[];
};
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
export type DiskUsage = { bytes: number; path: string };
export type DiskInspection = {
  root: string;
  filesystem: string;
  folders: DiskUsage[];
  errors: string[];
  isComplete: boolean;
};
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
export type RustArtifactKind = 'tmp' | 'coverage' | 'target';
export type RustOptions = RunOptions & { idle: number; artifacts: RustArtifactKind[] };
export type RustRemovalOptions = RunOptions & {
  projects: string[];
  artifacts: RustArtifactKind[];
  idleMs: number;
};
export type RustArtifact = { kind: RustArtifactKind; path: string; exists: boolean; bytes: number | null };
export type RustProject = {
  path: string;
  eligible: boolean;
  reason: string;
  error: string | null;
  latestActivityMs: number | null;
  pids: number[];
  processWarnings: string[];
  artifacts: RustArtifact[];
};
export type PreservedArtifact = { path: string; reason: string };
export type ArtifactSelection = { actions: Action[]; preserved: PreservedArtifact[] };
export type ProcessInspection = { pids: number[]; warnings: string[] };
export type InspectionCommandResult = { stdout: string; stderr: string; exitCode: number };
export type InspectionRunner = (args: string[]) => Promise<InspectionCommandResult>;
export type AssessmentOptions = { root: string; size: string; days: number; system: boolean };
export type AssessmentTask = { name: string; inspect: () => Promise<AssessmentSection> };
export type AssessmentSection = { name: string; isComplete: boolean; data: unknown; errors: string[] };
export type DiskAssessment = {
  root: string;
  isComplete: boolean;
  sections: AssessmentSection[];
  scope: { roots: string[]; exclusions: string[]; docker: string };
};
export type RustActivity = { latestActivityMs: number; pids: number[]; processWarnings: string[] };
