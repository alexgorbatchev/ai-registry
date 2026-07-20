#!/usr/bin/env bun
import { addVendoredSkillCommand } from "../commands/addVendoredSkillCommand";
import { getErrorMessage } from "../lib/getErrorMessage";

addVendoredSkillCommand().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
