#!/usr/bin/env bun
import { resolve } from "node:path";

import { ENTRY_POINT_COMMAND_LINES } from "../lib/entryPointCommandLines";
import { getErrorMessage } from "../lib/getErrorMessage";
import { readCommandLine } from "../lib/readCommandLine";
import { scheduledUpdate } from "../lib/scheduledUpdate";

const commandLine = readCommandLine(process.argv.slice(2), ENTRY_POINT_COMMAND_LINES["scheduled-update-worker.ts"]);

if (commandLine !== undefined) {
  scheduledUpdate(resolve(import.meta.dir, "../../../.."), process.execPath)
    .then((result) => {
      const isAgent = ["1", "true", "yes"].includes(process.env.AGENT ?? "");
      console.log(`${isAgent ? "OK:" : "[OK]"} scheduled update: ${result}`);
    })
    .catch((error) => {
      console.error(getErrorMessage(error));
      process.exitCode = 1;
    });
}
