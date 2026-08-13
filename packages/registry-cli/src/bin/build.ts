#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { buildCommand } from "../commands/buildCommand";
import { getErrorMessage } from "../lib/getErrorMessage";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    yes: { type: "boolean", short: "y" },
  },
  strict: false,
});

buildCommand({ hasAutoConfirm: Boolean(values.yes) }).catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
