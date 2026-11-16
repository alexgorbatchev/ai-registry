#!/usr/bin/env bun
import { smokeBootstrapCommand } from "../commands/smokeBootstrapCommand";
import { ENTRY_POINT_COMMAND_LINES } from "../lib/entryPointCommandLines";
import { getErrorMessage } from "../lib/getErrorMessage";
import { readCommandLine } from "../lib/readCommandLine";

const commandLine = readCommandLine(process.argv.slice(2), ENTRY_POINT_COMMAND_LINES["smoke-bootstrap.ts"]);

if (commandLine !== undefined) {
  smokeBootstrapCommand().catch((error) => {
    console.error(getErrorMessage(error));
    process.exit(1);
  });
}
