import { describe, expect, onTestFinished, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { codeList, fillTemplate, recordedEpic, renderBrief, renumber } from "../lib/brief";
import { configProblems, loadConfig, parseConfig, resolvePath } from "../lib/config";
import { factory_cli, factory_config, factory_file, factory_project, factory_testDirectory, SKILL } from "./fixtures";

describe("config", () => {
  test("accepts a complete config and one without the optional sections", () => {
    expect(configProblems(factory_config())).toEqual([]);
    const { library: _library, deploy: _deploy, ...minimal } = factory_config();
    expect(configProblems(minimal)).toEqual([]);
  });

  test("names every missing, invalid and unknown field", () => {
    const config = { ...factory_config(), product: "", lanes: 2, checks: { targeted: [], final: "x", extra: 1 } };
    const { disk: _disk, ...withoutDisk } = config;
    expect(configProblems(withoutDisk)).toEqual([
      "lanes: unknown field",
      "product: invalid value",
      "checks.extra: unknown field",
      "checks.targeted: invalid value",
      "disk: missing",
    ]);
    expect(configProblems([])).toEqual(["config: expected a JSON object"]);
    expect(configProblems({ ...factory_config(), qa: "x" })).toEqual(["qa: expected an object"]);
    expect(configProblems({ ...factory_config(), deploy: { url: "u", commands: ["c"] } })).toEqual([
      "deploy.where: missing",
    ]);
  });

  test("parseConfig reports invalid JSON and invalid fields with the source", () => {
    expect(() => parseConfig("{", "cfg.json")).toThrow("cfg.json: not valid JSON");
    expect(() => parseConfig("{}", "cfg.json")).toThrow("cfg.json is invalid:\n  product: missing");
  });

  test("resolves home, absolute and repository-relative paths", () => {
    expect(resolvePath("/repo", "~/x")).toBe(join(homedir(), "x"));
    expect(resolvePath("/repo", "/abs")).toBe("/abs");
    expect(resolvePath("/repo", "../ui")).toBe("/ui");
  });

  test("loadConfig finds the repository root and the state directory", () => {
    const root = realpathSync(factory_testDirectory("config-root"));
    const { configPath, state } = factory_project(root);
    const loaded = loadConfig(configPath);
    expect(loaded.root).toBe(root);
    expect(loaded.state).toBe(state);
    // From a linked worktree the root is still the main checkout, where units create their worktrees.
    Bun.spawnSync(
      ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "base"],
      { cwd: root },
    );
    const linked = join(factory_testDirectory("config-linked"), "wt");
    expect(Bun.spawnSync(["git", "worktree", "add", "-q", linked], { cwd: root }).exitCode).toBe(0);
    const linkedConfig = factory_file(
      join(linked, "app", ".ux-flow-redesign", "implementation", "config.json"),
      JSON.stringify(factory_config()),
    );
    expect(loadConfig(linkedConfig).root).toBe(root);
    // The test runner may place the temporary directory inside a repository; the ceiling stops Git's search there.
    const away = mkdtempSync(join(tmpdir(), "ux-impl-no-git-"));
    const ceiling = process.env.GIT_CEILING_DIRECTORIES;
    process.env.GIT_CEILING_DIRECTORIES = dirname(away);
    onTestFinished(() => {
      if (ceiling === undefined) delete process.env.GIT_CEILING_DIRECTORIES;
      else process.env.GIT_CEILING_DIRECTORIES = ceiling;
      rmSync(away, { recursive: true, force: true });
    });
    const outside = factory_file(join(away, "c.json"), JSON.stringify(factory_config()));
    expect(() => loadConfig(outside)).toThrow("not inside a Git repository");
  });
});

describe("templates", () => {
  test("fills placeholders, keeps sections with values and drops the rest", () => {
    const template =
      "A {{x}}.\n{{#y}}\nblock {{y}}\n{{/y}}\n{{#z}}\ngone {{z}}\n{{/z}}\nend{{#y}} and {{y}}{{/y}}{{#z}} never{{/z}}.\n";
    expect(fillTemplate(template, { x: "1", y: "2" })).toBe("A 1.\nblock 2\nend and 2.\n");
  });

  test("refuses to leave a placeholder unfilled", () => {
    expect(() => fillTemplate("{{a}} {{b}} {{a}}", { a: "" })).toThrow("no value for {{a}}, {{b}}");
  });

  test("lists and renumbers", () => {
    expect(codeList(["a"])).toBe("`a`");
    expect(codeList(["a", "b", "c"], "then")).toBe("`a`, `b` then `c`");
    expect(codeList([])).toBe("");
    expect(renumber("1. a\n   2. nested\n4. b\n7. c\n")).toBe("1. a\n   2. nested\n2. b\n3. c\n");
  });
});

describe("renderBrief", () => {
  test("fills every value from the config, the unit and the run's epic", () => {
    const root = realpathSync(factory_testDirectory("brief-root"));
    const { configPath, state } = factory_project(root);
    factory_file(join(state, "implementation", "slices.json"), JSON.stringify({ epic: 77, slices: {} }));
    const brief = renderBrief({ loaded: loadConfig(configPath), unit: "impl-12", tickets: [12, 13], skill: SKILL });
    expect(brief).toContain("# Unit brief: impl-12");
    expect(brief).toContain("Reports tickets #12, then #13");
    expect(brief).toContain(`\`${join(homedir(), ".local/share/ux-flow-redesign/reports/units/impl-12.json")}\``);
    expect(brief).toContain(`in the repository at \`${root}\``);
    expect(brief).toContain("Land: run `git push origin HEAD:main`.");
    expect(brief).toContain("The preview prints its URL; open that URL, never a guessed one.");
    expect(brief).toContain("`reports-impl-12`");
    expect(brief).toContain("`just run --host impl-12`");
    expect(brief).toContain("`bun install --frozen-lockfile` and delete `node_modules/.vite`");
    expect(brief).toContain(`@acme/ui goes into its repository at \`${join(dirname(root), "ui")}\``);
    expect(brief).toContain("ending in ` (#<ticket>)`");
    expect(brief).toContain("in epic #77 (project `acme/reports`)");
    expect(brief).toContain(`--ignore '#dev-toolbar'`);
    expect(brief).toContain("run the final gate once: `just verify`");
    expect(brief).toContain(join(homedir(), ".local/share/ux-flow-redesign/reports/shots/impl-12"));
    expect(brief).not.toMatch(/\{\{|\{unit\}|\{ticket\}/);
    const numbers = [...brief.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]));
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  test("drops the library, reinstall and suffix steps a project does not have", () => {
    const root = realpathSync(factory_testDirectory("brief-minimal"));
    const config = factory_config({
      worktree: { dir: ".workspaces", setup: ["just setup"] },
      preview: { start: "just run", host: "reports-{unit}" },
      repository: { remote: "origin", targetBranch: "main", land: "pull request" },
    });
    const { library: _library, ...withoutLibrary } = config;
    const { configPath } = factory_project(root, withoutLibrary);
    const brief = renderBrief({ loaded: loadConfig(configPath), unit: "impl-5", tickets: [5], skill: SKILL });
    expect(brief).not.toContain("goes into its repository");
    expect(brief).not.toContain("stale links");
    expect(brief).not.toContain("ending in");
    expect(brief).not.toContain("--ignore");
    expect(brief).not.toContain("never a guessed one");
    expect(brief).toContain("the run's epic");
    expect(brief).toContain("Land: open a pull request and merge it through the project's pull-request workflow.");
  });

  test("reads no epic from a missing or epic-less record", () => {
    const state = factory_testDirectory("epic-record");
    expect(recordedEpic(state)).toBeNull();
    factory_file(join(state, "implementation", "slices.json"), JSON.stringify({ slices: {} }));
    expect(recordedEpic(state)).toBeNull();
    factory_file(join(state, "implementation", "slices.json"), JSON.stringify({ epic: null, slices: {} }));
    expect(recordedEpic(state)).toBeNull();
  });
});

describe("render-brief CLI", () => {
  test("prints a brief, checks a config and rejects bad usage or configs", async () => {
    const root = realpathSync(factory_testDirectory("brief-cli"));
    const { configPath } = factory_project(root);
    const brief = await factory_cli("render-brief.ts", ["--config", configPath, "42"]);
    expect(brief.code).toBe(0);
    expect(brief.stdout).toContain("# Unit brief: impl-42");
    const named = await factory_cli("render-brief.ts", ["--config", configPath, "--unit", "impl-batch", "1", "2"]);
    expect(named.stdout).toContain("# Unit brief: impl-batch");
    expect((await factory_cli("render-brief.ts", ["--config", configPath, "--check"])).stdout).toStartWith("OK: ");
    expect((await factory_cli("render-brief.ts", ["--config", configPath])).code).toBe(2);
    expect((await factory_cli("render-brief.ts", ["--config", configPath, "x"])).code).toBe(2);
    expect((await factory_cli("render-brief.ts", ["--config", configPath, "--check", "1"])).code).toBe(2);
    expect((await factory_cli("render-brief.ts", ["--bogus"])).code).toBe(2);
    expect((await factory_cli("render-brief.ts", ["--help"])).code).toBe(0);
    factory_file(configPath, "{}");
    const invalid = await factory_cli("render-brief.ts", ["--config", configPath, "--check"]);
    expect(invalid.code).toBe(1);
    expect(invalid.stderr).toContain("product: missing");
  });
});
