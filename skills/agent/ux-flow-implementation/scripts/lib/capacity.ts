import { existsSync, readFileSync, statfsSync } from "node:fs";
import { availableParallelism, loadavg } from "node:os";

const GIB = 2 ** 30;

export interface CapacityReading {
  load1: number;
  cores: number;
  /** Share of memory free for new work, 0–100; null when the platform gives no reading. */
  memoryFreePercent: number | null;
  swapUsedGiB: number | null;
  diskFreeGiB: number;
}

export interface CapacityVerdict extends CapacityReading {
  path: string;
  diskFloorGiB: number;
  memoryFloorPercent: number;
  room: boolean;
  /** Each limit the reading breaks; empty when there is room. */
  reasons: string[];
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** Room for another heavy unit: load under the core count, memory above its floor, disk above its floor. */
export function judge(
  reading: CapacityReading,
  path: string,
  diskFloorGiB: number,
  memoryFloorPercent = 15,
): CapacityVerdict {
  const reasons: string[] = [];
  if (reading.load1 >= reading.cores)
    reasons.push(`1-minute load ${round(reading.load1)} is not below the ${reading.cores} cores`);
  if (reading.memoryFreePercent !== null && reading.memoryFreePercent < memoryFloorPercent)
    reasons.push(`memory free ${reading.memoryFreePercent}% is under ${memoryFloorPercent}%`);
  if (reading.diskFreeGiB < diskFloorGiB)
    reasons.push(`free disk ${round(reading.diskFreeGiB)} GiB on ${path} is under ${diskFloorGiB} GiB`);
  return {
    ...reading,
    load1: round(reading.load1),
    diskFreeGiB: round(reading.diskFreeGiB),
    path,
    diskFloorGiB,
    memoryFloorPercent,
    room: reasons.length === 0,
    reasons,
  };
}

/** `memory_pressure -Q` on macOS: "System-wide memory free percentage: 45%". */
export function parseMacMemory(output: string): number | null {
  const match = /free percentage:\s*(\d+)%/.exec(output);
  return match ? Number(match[1]) : null;
}

/** `sysctl -n vm.swapusage` on macOS: "total = 2048.00M  used = 1162.25M  free = 885.75M". */
export function parseMacSwap(output: string): number | null {
  const match = /used = ([\d.]+)([MG])/.exec(output);
  if (!match) return null;
  return round(Number(match[1]) / (match[2] === "G" ? 1 : 1024));
}

/** `/proc/meminfo` on Linux: MemAvailable against MemTotal, and swap in use. */
export function parseMeminfo(text: string): { memoryFreePercent: number | null; swapUsedGiB: number | null } {
  const field = (name: string): number | null => {
    const match = new RegExp(`^${name}:\\s+(\\d+) kB`, "m").exec(text);
    return match ? Number(match[1]) : null;
  };
  const [total, available, swapTotal, swapFree] = ["MemTotal", "MemAvailable", "SwapTotal", "SwapFree"].map(field);
  return {
    memoryFreePercent: total && available !== null ? Math.round((available / total) * 100) : null,
    swapUsedGiB: swapTotal !== null && swapFree !== null ? round((swapTotal - swapFree) / 1024 ** 2) : null,
  };
}

const command = (args: string[]): string => {
  const result = Bun.spawnSync(args, { stderr: "ignore" });
  return result.exitCode === 0 ? result.stdout.toString() : "";
};

/** Reads load, memory, swap and free disk on the volume holding `path`. */
export function readCapacity(path: string, platform = process.platform): CapacityReading {
  const stats = statfsSync(path);
  const base = { load1: loadavg()[0], cores: availableParallelism(), diskFreeGiB: (stats.bavail * stats.bsize) / GIB };
  if (platform === "darwin") {
    return {
      ...base,
      memoryFreePercent: parseMacMemory(command(["memory_pressure", "-Q"])),
      swapUsedGiB: parseMacSwap(command(["sysctl", "-n", "vm.swapusage"])),
    };
  }
  if (existsSync("/proc/meminfo")) return { ...base, ...parseMeminfo(readFileSync("/proc/meminfo", "utf8")) };
  return { ...base, memoryFreePercent: null, swapUsedGiB: null };
}
