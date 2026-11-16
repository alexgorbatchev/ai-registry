#!/usr/bin/env bun
import { buildCommand } from "../commands/buildCommand";
import { ENTRY_POINT_COMMAND_LINES } from "../lib/entryPointCommandLines";
import { getErrorMessage } from "../lib/getErrorMessage";
import { readCommandLine } from "../lib/readCommandLine";

const commandLine = readCommandLine(process.argv.slice(2), ENTRY_POINT_COMMAND_LINES["build.ts"]);

if (commandLine !== undefined) {
  buildCommand({ hasAutoConfirm: commandLine.flags.yes }).catch((error) => {
    console.error(getErrorMessage(error));
    process.exit(1);
  });
}
