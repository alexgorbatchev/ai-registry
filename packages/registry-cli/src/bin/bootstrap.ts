#!/usr/bin/env bun
import { bootstrapCommand } from "../commands/bootstrapCommand";
import { getErrorMessage } from "../lib/getErrorMessage";

bootstrapCommand().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
