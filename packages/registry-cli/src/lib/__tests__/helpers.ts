import { expect } from "bun:test";
import { resolve } from "node:path";

// The repository root, so tests behave the same from any working directory.
export const REPOSITORY_ROOT = resolve(import.meta.dir, "..", "..", "..", "..", "..");

export async function readTimestampedLog(logPath: string): Promise<string> {
  const log = await Bun.file(logPath).text();
  const prefix = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] /gm;
  expect(log.match(prefix)?.length ?? 0).toBe(log.split("\n").length - 1);
  return log.replace(prefix, "");
}
