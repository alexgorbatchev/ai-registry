import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, open, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { runCommand } from "../runCommand";

const entry = resolve(import.meta.dir, "../reviewer.ts");
const skillPath = resolve(import.meta.dir, "../../SKILL.md");
const scratchRoot = resolve(import.meta.dir, "../../../../../.tmp");
let directory: string;
let bundle: string;

beforeAll(async () => {
  await mkdir(scratchRoot, { recursive: true });
  directory = await mkdtemp(`${scratchRoot}/reviewer-cli-test-`);
  bundle = `${directory}/reviewer.js`;
  const result = await Bun.build({ entrypoints: [entry], outdir: directory, target: "bun", env: "disable" });
  expect(result.success).toBe(true);
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("reviewer CLI", () => {
  it.each(["0", "1"])("prints the embedded skill verbatim without credentials in mode %s", async AGENT => {
    // The bundle has no source files or installed packages beside it.
    const result = await runCommand([process.execPath, bundle, "skill"], { AGENT });
    expect(result).toEqual({ code: 0, stdout: await Bun.file(skillPath).text(), stderr: "" });
  });

  it.each([
    { args: ["--help"] }, { args: ["access", "--help"] }, { args: ["access", "ensure", "--help"] }, { args: ["skill", "--help"] },
    { args: ["help"] }, { args: ["help", "access"] }, { args: ["access", "help", "ensure"] }, { args: ["help", "--help"] },
  ])("includes the agent alert on help path %j", async ({ args }) => {
    const result = await runCommand([process.execPath, bundle, ...args], { AGENT: "1" });
    expect(result.code).toBe(0);
    expect(result.stdout.split("\n")[0]).toBe("ALERT: Agents must read `AGENT=1 reviewer skill` before using this tool.");
    expect(result.stderr).toBe("");
  });

  it("renders human help without agent directives or wrapping", async () => {
    const result = await runCommand([process.execPath, bundle, "--help"], { AGENT: "0" });
    expect(result.code).toBe(0);
    expect(result.stdout.split("\n")[0]).toBe("Usage: reviewer [options] [command]");
    expect(result.stdout.trimEnd().split("\n").every(line => Bun.stringWidth(line) <= 100)).toBe(true);
  });

  it("rejects extra skill arguments", async () => {
    expect(await runCommand([process.execPath, bundle, "skill", "extra"], {})).toEqual({
      code: 1, stdout: "", stderr: "error: too many arguments for 'skill'. Expected 0 arguments but got 1.\n",
    });
  });

  it("returns a failure when the embedded skill cannot be written", async () => {
    const destination = await open(bundle, "r");
    try {
      const child = Bun.spawn([process.execPath, bundle, "skill"], { env: {}, stdout: destination.fd, stderr: "pipe" });
      expect(await child.exited).toBe(1);
      expect((await new Response(child.stderr).text()).split(":")[0]).toBe("ERR");
    } finally {
      await destination.close();
    }
  });

  it("fails before GitHub access if the configured token is absent", async () => {
    expect(await runCommand([process.execPath, bundle, "access", "ensure", "--repo", "example/project", "--reviewer", "review-bot", "--token-env", "MISSING_TOKEN"], {})).toEqual({
      code: 1, stdout: "", stderr: "ERR: Reviewer token environment variable MISSING_TOKEN is not set.\n",
    });
  });
});
