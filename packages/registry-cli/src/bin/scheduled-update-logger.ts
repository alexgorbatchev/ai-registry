#!/usr/bin/env bun
import { ENTRY_POINT_COMMAND_LINES } from "../lib/entryPointCommandLines";
import { getErrorMessage } from "../lib/getErrorMessage";
import { readCommandLine } from "../lib/readCommandLine";
import { runLoggedScheduledUpdate } from "../lib/runLoggedScheduledUpdate";

async function main(): Promise<void> {
  // The launcher passes its worker as data; this internal entrypoint runs under the native lock.
  const workerCommand: unknown = JSON.parse(process.env.AI_REGISTRY_SCHEDULED_WORKER ?? "null");
  if (
    !Array.isArray(workerCommand) ||
    workerCommand.length === 0 ||
    !workerCommand.every((argument): argument is string => typeof argument === "string")
  ) {
    throw new Error("Scheduled update logger requires a worker command from its launcher.");
  }
  const exitCode = await runLoggedScheduledUpdate(process.cwd(), workerCommand);
  // Exit 75 is reserved for native lock contention, never a worker failure.
  process.exitCode = exitCode === 75 ? 1 : exitCode;
}

const commandLine = readCommandLine(process.argv.slice(2), ENTRY_POINT_COMMAND_LINES["scheduled-update-logger.ts"]);

if (commandLine !== undefined) {
  main().catch((error) => {
    console.error(getErrorMessage(error));
    process.exitCode = 1;
  });
}
