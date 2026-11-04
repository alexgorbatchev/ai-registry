#!/usr/bin/env bun
import { resolve } from "node:path";

import { getErrorMessage } from "../lib/getErrorMessage";
import { getScheduledUpdatePaths } from "../lib/getScheduledUpdatePaths";
import { runLockedScheduledUpdate } from "../lib/runLockedScheduledUpdate";

const repositoryRoot = resolve(import.meta.dir, "../../../..");

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
