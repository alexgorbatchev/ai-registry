#!/usr/bin/env bun
import { addVendoredSkillCommand } from "../commands/addVendoredSkillCommand";
import { ENTRY_POINT_COMMAND_LINES } from "../lib/entryPointCommandLines";
import { getErrorMessage } from "../lib/getErrorMessage";
import { readCommandLine } from "../lib/readCommandLine";

const commandLine = readCommandLine(process.argv.slice(2), ENTRY_POINT_COMMAND_LINES["add-vendored-skill.ts"]);

if (commandLine !== undefined) {
  addVendoredSkillCommand().catch((error) => {
    console.error(getErrorMessage(error));
    process.exit(1);
  });
}
