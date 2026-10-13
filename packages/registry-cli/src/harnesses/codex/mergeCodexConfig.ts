import { deepmergeCustom } from "deepmerge-ts";
import { parse, stringify } from "smol-toml";

const mergeConfig = deepmergeCustom({ mergeArrays: false });

export function mergeCodexConfig(existingText: string, harnessText: string): string {
  const existing = parse(existingText, { integersAsBigInt: true });
  const harness = parse(harnessText, { integersAsBigInt: true });
  const merged = stringify(mergeConfig(existing, harness), { numbersAsFloat: true });
  if (merged === stringify(existing, { numbersAsFloat: true })) {
    return existingText;
  }
  return merged;
}
