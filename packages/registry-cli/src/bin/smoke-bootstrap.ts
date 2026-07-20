#!/usr/bin/env bun
import { smokeBootstrapCommand } from "../commands/smokeBootstrapCommand";
import { getErrorMessage } from "../lib/getErrorMessage";

smokeBootstrapCommand().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
