import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import { addVendoredSkillCommand } from "../addVendoredSkillCommand";
import type { IRunCommandSpawnOptions, IRunCommandSpawnedProcess } from "../../lib/runCommand";

const ROOT = "/registry";

describe("addVendoredSkillCommand", () => {
  let spawnedCommands: string[][];
  let relocations: Array<[string, string, string | undefined]>;

  function spawn(options: IRunCommandSpawnOptions): IRunCommandSpawnedProcess {
    spawnedCommands.push(options.cmd);
    return { exited: Promise.resolve(0) };
  }

  async function relocate(root: string, skillName: string, source?: string): Promise<void> {
    relocations.push([root, skillName, source]);
  }

  function run(command: string): Promise<void> {
    return addVendoredSkillCommand({ argv: ["bun", "add-vendored-skill.ts", command], root: ROOT, relocate, spawn });
  }

  beforeEach(() => {
    spawnedCommands = [];
    relocations = [];
    spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
  });

  it("vendors every requested skill as a copied openclaw install, relocates it, then rebuilds", async () => {
    await run("npx skills add https://github.com/shadcn/ui --skill shadcn -s forms");

    expect(spawnedCommands).toEqual([
      ["npx", "skills", "add", "https://github.com/shadcn/ui", "--skill", "shadcn", "-a", "openclaw", "--copy", "-y"],
      ["npx", "skills", "add", "https://github.com/shadcn/ui", "--skill", "forms", "-a", "openclaw", "--copy", "-y"],
      ["bun", "run", "build"],
    ]);
    expect(relocations).toEqual([
      [ROOT, "shadcn", "https://github.com/shadcn/ui"],
      [ROOT, "forms", "https://github.com/shadcn/ui"],
    ]);
  });

  it("accepts a bare source with quoted and escaped arguments", async () => {
    await run(`skills add "owner/repo name" --skill 'two words' --skill escaped\\ name`);

    expect(relocations).toEqual([
      [ROOT, "two words", "owner/repo name"],
      [ROOT, "escaped name", "owner/repo name"],
    ]);
  });

  it("keeps a trailing backslash as part of the last argument", async () => {
    await run("owner/repo --skill name\\");

    expect(relocations).toEqual([[ROOT, "name\\", "owner/repo"]]);
  });

  it("stops before relocating when the install fails", async () => {
    const failingSpawn = (options: IRunCommandSpawnOptions): IRunCommandSpawnedProcess => {
      spawnedCommands.push(options.cmd);
      return { exited: Promise.resolve(1) };
    };

    await expect(addVendoredSkillCommand({
      argv: ["bun", "add-vendored-skill.ts", "owner/repo --skill one"],
      root: ROOT,
      relocate,
      spawn: failingSpawn,
    })).rejects.toThrow("Failed to vendor skill one (exit code 1).");
    expect(relocations).toEqual([]);
  });

  it("rejects a missing command", async () => {
    await expect(addVendoredSkillCommand({ argv: ["bun", "add-vendored-skill.ts"], root: ROOT, relocate, spawn }))
      .rejects.toThrow("Missing command. Example: bun run skills:add 'npx skills add https://github.com/shadcn/ui --skill shadcn'");
  });

  it.each([
    ["owner/repo --skill 'open", "Unterminated quoted string in command: owner/repo --skill 'open"],
    ["owner/repo --skill", "Missing value for --skill"],
    ["owner/repo --skill one -a codex", "-a is managed automatically by bun run skills:add. Pass only the original source and --skill options."],
    ["owner/repo --skill one --global", "--global is not supported by bun run skills:add."],
    ["owner/repo --skill one --branch main", "Unsupported option for bun run skills:add: --branch"],
    ["owner/repo other/repo --skill one", "Unexpected extra positional argument: other/repo"],
    ["--skill one", "Missing source in skills add command."],
    ["owner/repo", "bun run skills:add requires at least one --skill <name> option."],
  ])("rejects %p", async (command, message) => {
    await expect(run(command)).rejects.toThrow(message);
    expect(spawnedCommands).toEqual([]);
  });
});
