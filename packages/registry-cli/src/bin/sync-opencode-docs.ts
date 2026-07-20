#!/usr/bin/env bun
import { syncOpencodeDocsCommand } from "../commands/syncOpencodeDocsCommand";
import { getErrorMessage } from "../lib/getErrorMessage";

syncOpencodeDocsCommand().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
