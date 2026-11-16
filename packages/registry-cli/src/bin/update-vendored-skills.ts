#!/usr/bin/env bun
import { updateVendoredSkillsCommand } from "../commands/updateVendoredSkillsCommand";
import { ENTRY_POINT_COMMAND_LINES } from "../lib/entryPointCommandLines";
import { getErrorMessage } from "../lib/getErrorMessage";
import { readCommandLine } from "../lib/readCommandLine";

const commandLine = readCommandLine(process.argv.slice(2), ENTRY_POINT_COMMAND_LINES["update-vendored-skills.ts"]);

if (commandLine !== undefined) {
  updateVendoredSkillsCommand().catch((error) => {
    console.error(getErrorMessage(error));
    process.exit(1);
  });
}
