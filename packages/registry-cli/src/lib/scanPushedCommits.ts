import type { GitleaksResult } from "./runGitleaks";

// Scans the commits selected by `git log` options, such as `base..tip`.
export type IScanCommitRange = (logOptions: string) => Promise<GitleaksResult>;

export interface IScanPushedCommitsOptions {
  // The pre-push hook's standard input: one `<local ref> <local sha> <remote ref> <remote sha>` line per ref.
  input: string;
  remoteName: string;
  scanCommitRange: IScanCommitRange;
}

function isNullObjectId(objectId: string): boolean {
  return /^0+$/.test(objectId);
}

// Every commit a push would publish: new history on an existing branch, or for a
// new branch everything not yet on the remote. Deletions publish nothing.
function getPushedCommitRanges(input: string, remoteName: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((fields) => fields.length === 4)
    .flatMap(([, localObjectId, , remoteObjectId]) => {
      if (localObjectId === undefined || remoteObjectId === undefined || isNullObjectId(localObjectId)) return [];
      return isNullObjectId(remoteObjectId)
        ? [`${localObjectId} --not --remotes=${remoteName}`]
        : [`${remoteObjectId}..${localObjectId}`];
    });
}

// Blocks a push when gitleaks finds secrets in any commit it would publish.
export async function scanPushedCommits(options: IScanPushedCommitsOptions): Promise<void> {
  for (const range of getPushedCommitRanges(options.input, options.remoteName)) {
    if (await options.scanCommitRange(range) === "leaks") {
      throw new Error(
        `Push blocked: gitleaks found secrets in ${range}. Remove them from the outgoing commits, or record a reviewed false positive in .gitleaksignore, before pushing.`,
      );
    }
  }
}
