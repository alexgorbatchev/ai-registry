#!/usr/bin/env bun
import { updateVendoredSkillsCommand } from "../commands/updateVendoredSkillsCommand";
import { getErrorMessage } from "../lib/getErrorMessage";

updateVendoredSkillsCommand().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
