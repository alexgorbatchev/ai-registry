import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

import { writeTimestampedOutput } from "../writeTimestampedOutput";

describe("writeTimestampedOutput", () => {
  it.each([
    ["America/Los_Angeles", "2026-10-16T20:09:07Z", "2026-10-16 13:09"],
    ["America/Los_Angeles", "2026-01-16T20:09:07Z", "2026-01-16 12:09"],
    ["Asia/Tokyo", "2026-10-16T20:09:07Z", "2026-10-17 05:09"],
    ["UTC", "2026-01-02T00:03:59Z", "2026-01-02 00:03"],
  ])("formats human dates using the process timezone %s at %s", async (timezone, instant, expected) => {
    const sourcePath = resolve("packages/registry-cli/src/lib/writeTimestampedOutput.ts");
    const script = [
      `import { writeTimestampedOutput } from ${JSON.stringify(sourcePath)};`,
      'await writeTimestampedOutput(new Blob(["message\\n"]).stream(),',
      'async (output) => { process.stdout.write(output); },',
      `() => new Date(${JSON.stringify(instant)}));`,
    ].join("\n");
    const subprocess = Bun.spawn([process.execPath, "-e", script], {
      env: { ...process.env, TZ: timezone },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [output, error, exitCode] = await Promise.all([
      new Response(subprocess.stdout).text(),
      new Response(subprocess.stderr).text(),
      subprocess.exited,
    ]);
    expect(exitCode, error).toBe(0);
    expect(output).toBe(`[${expected}] message\n`);
  });

  it("handles split UTF-8 characters, split lines, CRLF, blank lines and an unterminated last line", async () => {
    const bytes = new TextEncoder().encode("café\r\n\nlast");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 4));
        controller.enqueue(bytes.slice(4, 7));
        controller.enqueue(bytes.slice(7));
        controller.close();
      },
    });
    const output: string[] = [];
    const date = new Date(2026, 9, 16, 13, 9, 7);
    await writeTimestampedOutput(stream, async (text) => { output.push(text); }, () => date);
    expect(output.join("")).toBe("[2026-10-16 13:09] café\n[2026-10-16 13:09] \n[2026-10-16 13:09] last\n");
  });

  it("does not emit a spurious line for an empty stream", async () => {
    const output: string[] = [];
    await writeTimestampedOutput(new Blob([]).stream(), async (text) => { output.push(text); });
    expect(output).toEqual([]);
  });
});
