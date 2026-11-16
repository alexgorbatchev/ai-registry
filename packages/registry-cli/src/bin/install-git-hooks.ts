#!/usr/bin/env bun
import { installGitHooksCommand } from "../commands/installGitHooksCommand";
import { ENTRY_POINT_COMMAND_LINES } from "../lib/entryPointCommandLines";
import { getErrorMessage } from "../lib/getErrorMessage";
import { readCommandLine } from "../lib/readCommandLine";

const commandLine = readCommandLine(process.argv.slice(2), ENTRY_POINT_COMMAND_LINES["install-git-hooks.ts"]);

if (commandLine !== undefined) {
  installGitHooksCommand().catch((error) => {
    console.error(getErrorMessage(error));
    process.exit(1);
  });
}
