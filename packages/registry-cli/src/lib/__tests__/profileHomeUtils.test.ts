import { describe, expect, it } from "bun:test";
import { homedir } from "os";
import { join } from "path";

import { getProfileHomeDir, getProfileHomeShellPath } from "../profileHomeUtils";

function resolveShellPath(shellPath: string, environment: Record<string, string>): string {
  const result = Bun.spawnSync(["bash", "-c", `printf '%s' "${shellPath}"`], { env: environment });
  expect(result.exitCode).toBe(0);
  return result.stdout.toString();
}

describe("profileHomeUtils", () => {
  it("places a profile home under XDG_DATA_HOME", () => {
    expect(getProfileHomeDir("codex", "designer", { XDG_DATA_HOME: "/data" })).toBe(
      "/data/ai-registry/codex/profiles/designer",
    );
  });

  it("falls back to ~/.local/share when XDG_DATA_HOME is unset or blank", () => {
    const expectedPath = join(homedir(), ".local", "share", "ai-registry", "pi", "profiles", "developer");
    expect(getProfileHomeDir("pi", "developer", {})).toBe(expectedPath);
    expect(getProfileHomeDir("pi", "developer", { XDG_DATA_HOME: "  " })).toBe(expectedPath);
  });

  it("spells the same location for launchers, resolved by the shell at run time", () => {
    const shellPath = getProfileHomeShellPath("claude-code", "designer");

    expect(resolveShellPath(shellPath, { HOME: "/home/user", XDG_DATA_HOME: "/data" })).toBe(
      getProfileHomeDir("claude-code", "designer", { XDG_DATA_HOME: "/data" }),
    );
    expect(resolveShellPath(shellPath, { HOME: "/home/user" })).toBe(
      "/home/user/.local/share/ai-registry/claude-code/profiles/designer",
    );
  });
});
