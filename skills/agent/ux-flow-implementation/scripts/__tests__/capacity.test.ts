import { describe, expect, test } from "bun:test";
import { judge, parseMacMemory, parseMacSwap, parseMeminfo, readCapacity } from "../lib/capacity";
import { factory_cli, factory_testDirectory } from "./fixtures";

const ROOMY = { load1: 3.2, cores: 14, memoryFreePercent: 60, swapUsedGiB: 1, diskFreeGiB: 120 };

describe("judge", () => {
  test("finds room only when load, memory and disk are all inside their limits", () => {
    expect(judge(ROOMY, "/data", 8)).toMatchObject({
      room: true,
      reasons: [],
      diskFloorGiB: 8,
      memoryFloorPercent: 15,
    });
    const full = judge(
      { load1: 27.123, cores: 14, memoryFreePercent: 9, swapUsedGiB: 11.8, diskFreeGiB: 6.456 },
      "/data",
      8,
    );
    expect(full.room).toBe(false);
    expect(full.reasons).toEqual([
      "1-minute load 27.12 is not below the 14 cores",
      "memory free 9% is under 15%",
      "free disk 6.46 GiB on /data is under 8 GiB",
    ]);
    expect(judge({ ...ROOMY, memoryFreePercent: null }, "/", 8, 50).room).toBe(true);
  });
});

describe("platform readings", () => {
  test("parse macOS memory and swap output", () => {
    expect(parseMacMemory("The system has ...\nSystem-wide memory free percentage: 45%\n")).toBe(45);
    expect(parseMacMemory("")).toBeNull();
    expect(parseMacSwap("total = 9216.00M  used = 7812.19M  free = 1403.81M  (encrypted)")).toBe(7.63);
    expect(parseMacSwap("total = 20.00G  used = 11.80G  free = 8.20G")).toBe(11.8);
    expect(parseMacSwap("")).toBeNull();
  });

  test("parse Linux meminfo", () => {
    const text =
      "MemTotal:       16000000 kB\nMemAvailable:    4000000 kB\nSwapTotal:       2097152 kB\nSwapFree:        1048576 kB\n";
    expect(parseMeminfo(text)).toEqual({ memoryFreePercent: 25, swapUsedGiB: 1 });
    expect(parseMeminfo("")).toEqual({ memoryFreePercent: null, swapUsedGiB: null });
  });

  test("reads this machine", () => {
    const reading = readCapacity(factory_testDirectory("capacity"));
    expect(reading.cores).toBeGreaterThan(0);
    expect(reading.diskFreeGiB).toBeGreaterThan(0);
    expect(readCapacity("/", "aix").memoryFreePercent === null || process.platform === "linux").toBe(true);
  });
});

test("the CLI prints a verdict and exits by it", async () => {
  const dir = factory_testDirectory("capacity-cli");
  const roomy = await factory_cli("capacity.ts", ["--path", dir, "--floor-gib", "0", "--memory-floor", "0"]);
  const verdict = JSON.parse(roomy.stdout);
  expect(verdict.path).toBe(dir);
  expect(roomy.code).toBe(verdict.room ? 0 : 1);
  const full = await factory_cli("capacity.ts", ["--path", dir, "--floor-gib", "999999"]);
  expect(full.code).toBe(1);
  expect(JSON.parse(full.stdout).reasons.join()).toContain("free disk");
  expect((await factory_cli("capacity.ts", [])).code).toBe(2);
  expect((await factory_cli("capacity.ts", ["--path", dir, "--floor-gib", "x"])).code).toBe(2);
  expect((await factory_cli("capacity.ts", ["--nope"])).code).toBe(2);
  expect((await factory_cli("capacity.ts", ["--path", `${dir}/missing`])).code).toBe(2);
  expect((await factory_cli("capacity.ts", ["--help"])).code).toBe(0);
});
