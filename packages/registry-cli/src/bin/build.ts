#!/usr/bin/env bun
import { buildCommand } from "../commands/buildCommand";
import { ENTRY_POINT_COMMAND_LINES } from "../lib/entryPointCommandLines";
import { getErrorMessage } from "../lib/getErrorMessage";
import { readCommandLine } from "../lib/readCommandLine";
import { BUILD_LOCK_HELD_ENV, runUnderBuildLock } from "../lib/runUnderBuildLock";

const commandLine = readCommandLine(process.argv.slice(2), ENTRY_POINT_COMMAND_LINES["build.ts"]);

if (commandLine !== undefined) {
  if (process.env[BUILD_LOCK_HELD_ENV] === "1") {
    buildCommand({ hasAutoConfirm: commandLine.flags.yes }).catch((error) => {
      console.error(getErrorMessage(error));
      process.exit(1);
    });
  } else {
    // Rerun this entrypoint under the checkout's build lock, so concurrent builds take turns.
    runUnderBuildLock(process.cwd(), [process.execPath, import.meta.path, ...process.argv.slice(2)]).then(
      (exitCode) => process.exit(exitCode),
      (error: unknown) => {
        console.error(getErrorMessage(error));
        process.exit(1);
      },
    );
  }
}
