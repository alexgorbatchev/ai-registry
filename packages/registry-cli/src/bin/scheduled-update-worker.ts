#!/usr/bin/env bun
import { resolve } from "node:path";

import { getErrorMessage } from "../lib/getErrorMessage";
import { scheduledUpdate } from "../lib/scheduledUpdate";

scheduledUpdate(resolve(import.meta.dir, "../../../.."), process.execPath)
  .then((result) => {
    const isAgent = ["1", "true", "yes"].includes(process.env.AGENT ?? "");
    console.log(`${isAgent ? "OK:" : "[OK]"} scheduled update: ${result}`);
  })
  .catch((error) => {
    console.error(getErrorMessage(error));
    process.exitCode = 1;
  });
