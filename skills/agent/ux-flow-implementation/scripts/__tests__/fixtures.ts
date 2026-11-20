import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseConfig, type ProjectConfig } from "../lib/config";

export { factory_testDirectory, factory_testRoot } from "../../../../../packages/registry-cli/src/__tests__/fixtures";

export const SCRIPTS = join(import.meta.dir, "..");
export const SKILL = join(import.meta.dir, "../..");

/** The skill's example config for an imaginary reports app, which the tests also keep valid. */
export function factory_config(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return { ...parseConfig(readFileSync(join(SKILL, "assets", "config.example.json"), "utf8")), ...overrides };
}

/** A Git repository with `<state>/implementation/config.json`; returns the config path and state directory. */
export function factory_project(
  root: string,
  config: unknown = factory_config(),
): { configPath: string; state: string } {
  Bun.spawnSync(["git", "init", "-q", root]);
  const state = join(root, "app", ".ux-flow-redesign");
  const configPath = join(state, "implementation", "config.json");
  factory_file(configPath, JSON.stringify(config, null, 2));
  return { configPath, state };
}

export function factory_file(path: string, text: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
}

/** A proposal with a numbered "Recommended priority" list and a Seams paragraph. */
export function factory_proposal(title: string, slices: string[], seams = "Seams: none worth naming."): string {
  return [
    "---",
    "status: current",
    "---",
    "",
    `# ${title}: proposed experience`,
    "",
    "## Recommended priority",
    "",
    "**P1.** Ordinary use hits it.",
    "",
    ...slices.map((slice, i) => `${i + 1}. **${slice}** Detail of slice ${i + 1}.`),
    "",
    seams,
    "",
    "## Later section",
    "",
    "1. **Not a slice.** Outside the section.",
    "",
  ].join("\n");
}

export async function factory_cli(
  script: string,
  args: string[],
  options: { cwd?: string } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = Bun.spawn(["bun", join(SCRIPTS, script), ...args], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: options.cwd,
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { code, stdout, stderr };
}
