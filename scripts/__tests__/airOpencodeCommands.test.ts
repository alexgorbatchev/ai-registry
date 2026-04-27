import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const SCRIPTS_DIR = resolve(REPO_ROOT, ".output", "bin");
const TMP_DIR = resolve(REPO_ROOT, ".tmp");

interface IHelpResult {
  exitCode: number | null;
  stderr: string;
  stdout: string;
}

function runHelpAtPath(commandPath: string): IHelpResult {
  const result = spawnSync(commandPath, ["--help"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });

  assert.equal(result.error, undefined);

  return {
    exitCode: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function runHelp(commandName: string): IHelpResult {
  return runHelpAtPath(resolve(SCRIPTS_DIR, commandName));
}

function runHelpViaSymlink(commandName: string): IHelpResult {
  mkdirSync(TMP_DIR, { recursive: true });
  const tempDir = mkdtempSync(resolve(TMP_DIR, "air-opencode-wrapper-"));
  const symlinkPath = resolve(tempDir, commandName);

  symlinkSync(resolve(SCRIPTS_DIR, commandName), symlinkPath);

  try {
    return runHelpAtPath(symlinkPath);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

describe("air-opencode wrappers", () => {
  it("shows help for the session analysis wrapper", () => {
    const result = runHelp("air-opencode-session-analysis");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatchInlineSnapshot(`
"Usage: air-opencode-session-analysis [options] [command]

Reports OpenCode sessions and skill usage using the current SQLite storage.

Options:
  -h, --help          display help for command

Commands:
  skills [options]    Show skill usage across sessions or sync selected skills
  sessions [options]
  help [command]      display help for command
"
`);
  });

  it("shows help for the session analysis wrapper when invoked via a symlink", () => {
    const directResult = runHelp("air-opencode-session-analysis");
    const symlinkResult = runHelpViaSymlink("air-opencode-session-analysis");

    expect(symlinkResult).toEqual(directResult);
  });

  it("shows help for the session export wrapper", () => {
    const result = runHelp("air-opencode-session-export");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatchInlineSnapshot(`
"Usage: air-opencode-session-export <session-id> [output-directory] [--db <path-to-opencode.db>]
- output-directory defaults to ./long-session
- exports NDJSON files plus SESSION.md into that directory
"
`);
  });

  it("shows help for the session export wrapper when invoked via a symlink", () => {
    const directResult = runHelp("air-opencode-session-export");
    const symlinkResult = runHelpViaSymlink("air-opencode-session-export");

    expect(symlinkResult).toEqual(directResult);
  });

  it("shows help for the conversation extract wrapper", () => {
    const result = runHelp("air-opencode-conversation-extract");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatchInlineSnapshot(`
"Usage: air-opencode-conversation-extract [--output-dir <path>] [--db <path-to-opencode.db>] [--storage-dir <path-to-storage-dir>]
- output-dir defaults to .opencode-analysis under the resolved repo root
- extracts user messages into all_messages.jsonl plus chunk_N.jsonl files
- falls back to the legacy storage directory when SQLite is unavailable
"
`);
  });

  it("shows help for the conversation extract wrapper when invoked via a symlink", () => {
    const directResult = runHelp("air-opencode-conversation-extract");
    const symlinkResult = runHelpViaSymlink("air-opencode-conversation-extract");

    expect(symlinkResult).toEqual(directResult);
  });
});
