import { expect } from "bun:test";

export async function readTimestampedLog(logPath: string): Promise<string> {
  const log = await Bun.file(logPath).text();
  const prefix = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] /gm;
  expect(log.match(prefix)?.length ?? 0).toBe(log.split("\n").length - 1);
  return log.replace(prefix, "");
}
