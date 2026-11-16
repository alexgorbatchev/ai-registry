#!/usr/bin/env bun
import { syncOpencodeDocsCommand } from "../commands/syncOpencodeDocsCommand";
import { ENTRY_POINT_COMMAND_LINES } from "../lib/entryPointCommandLines";
import { getErrorMessage } from "../lib/getErrorMessage";
import { readCommandLine } from "../lib/readCommandLine";

const commandLine = readCommandLine(process.argv.slice(2), ENTRY_POINT_COMMAND_LINES["sync-opencode-docs.ts"]);

if (commandLine !== undefined) {
  syncOpencodeDocsCommand().catch((error) => {
    console.error(getErrorMessage(error));
    process.exit(1);
  });
}
