#!/usr/bin/env bun
import { installGitHooksCommand } from "../commands/installGitHooksCommand";
import { getErrorMessage } from "../lib/getErrorMessage";

installGitHooksCommand().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
