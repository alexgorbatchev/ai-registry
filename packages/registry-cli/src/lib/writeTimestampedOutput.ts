type IOutputWriter = (output: string) => Promise<void>;
type IClock = () => Date;

export async function writeTimestampedOutput(
  stream: ReadableStream<Uint8Array>,
  write: IOutputWriter,
  now: IClock = () => new Date(),
): Promise<void> {
  const formatTimestamp = (date: Date): string => {
    const year = String(date.getFullYear()).padStart(4, "0");
    const [month, day, hour, minute] = [
      date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(),
    ].map((part) => String(part).padStart(2, "0"));
    return `${year}-${month}-${day} ${hour}:${minute}`;
  };
  const decoder = new TextDecoder();
  let pending = "";
  for await (const chunk of stream) {
    const lines = (pending + decoder.decode(chunk, { stream: true })).split("\n");
    pending = lines.pop() ?? "";
    if (lines.length > 0) {
      await write(lines.map((line) => `[${formatTimestamp(now())}] ${line.replace(/\r$/, "")}\n`).join(""));
    }
  }
  pending += decoder.decode();
  if (pending) {
    await write(`[${formatTimestamp(now())}] ${pending}\n`);
  }
}
