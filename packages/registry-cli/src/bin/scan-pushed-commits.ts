#!/usr/bin/env bun
import { getErrorMessage } from "../lib/getErrorMessage";
import { runGitleaks } from "../lib/runGitleaks";
import { scanPushedCommits } from "../lib/scanPushedCommits";

// Git pre-push hook: `pre-push <remote name> <remote url>` with the pushed refs on stdin.
const repositoryRoot = process.cwd();

scanPushedCommits({
  input: await Bun.stdin.text(),
  remoteName: process.argv[2] ?? "origin",
  scanCommitRange: (logOptions) => runGitleaks(["git", "--log-opts", logOptions, repositoryRoot], repositoryRoot),
}).catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
