#!/usr/bin/env bun
import { resolve } from "node:path";

import { ENTRY_POINT_COMMAND_LINES } from "../lib/entryPointCommandLines";
import { getErrorMessage } from "../lib/getErrorMessage";
import { getScheduledUpdatePaths } from "../lib/getScheduledUpdatePaths";
import { readCommandLine } from "../lib/readCommandLine";
import { runLockedScheduledUpdate } from "../lib/runLockedScheduledUpdate";

const repositoryRoot = resolve(import.meta.dir, "../../../..");

const commandLine = readCommandLine(process.argv.slice(2), ENTRY_POINT_COMMAND_LINES["scheduled-update.ts"]);

if (commandLine !== undefined) {
  runLockedScheduledUpdate(repositoryRoot, [process.execPath, resolve(import.meta.dir, "scheduled-update-worker.ts")])
    .then((result) => {
      const isAgent = ["1", "true", "yes"].includes(process.env.AGENT ?? "");
      const message = result === "busy" ? "skipped (another run is active)" : "completed";
      console.log(
        `${isAgent ? "OK:" : "[OK]"} scheduled update: ${message}; log: ${getScheduledUpdatePaths(repositoryRoot).logPath}`,
      );
    })
    .catch((error) => {
      console.error(getErrorMessage(error));
      process.exitCode = 1;
    });
}
