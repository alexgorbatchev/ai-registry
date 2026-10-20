import { $ } from "bun";

export async function pruneScheduledUpdateLog(logPath: string, now: Date = new Date()): Promise<void> {
  const log = Bun.file(logPath);
  if (!(await log.exists())) return;

  // Log timestamps have minute precision and use the process's local timezone.
  const cutoff = Math.floor((now.getTime() - 48 * 60 * 60 * 1000) / 60000) * 60000;
  const retained = (await log.text()).split("\n").filter((line) => {
    const timestamp = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] /.exec(line)?.[1];
    return timestamp !== undefined && Date.parse(`${timestamp.replace(" ", "T")}:00`) >= cutoff;
  });
  const temporaryPath = `${logPath}.pruning`;
  try {
    await Bun.write(temporaryPath, retained.length > 0 ? `${retained.join("\n")}\n` : "");
    await $`mv -f ${temporaryPath} ${logPath}`;
  } finally {
    if (await Bun.file(temporaryPath).exists()) await Bun.file(temporaryPath).delete();
  }
}
