#!/usr/bin/env bun
import { buildCommand } from "../commands/buildCommand";
import { getErrorMessage } from "../lib/getErrorMessage";

const hasAutoConfirm = process.argv.includes("-y") || process.argv.includes("--yes");

buildCommand({ hasAutoConfirm }).catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
