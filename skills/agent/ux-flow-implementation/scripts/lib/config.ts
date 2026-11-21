import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

/**
 * The per-project config: project facts only (paths, commands, hosts, the deploy recipe). Policy lives in the
 * skill and in the shared instructions, never here. Strings may contain `{unit}` and `{ticket}`, filled per unit.
 */
export interface ProjectConfig {
  /** The product name used in ticket titles and briefs. */
  product: string;
  tracker: {
    /** The issue-tracker project slice tickets are filed in. */
    project: string;
    /** Labels every slice ticket gets, besides its priority label. */
    labels: string[];
  };
  repository: {
    remote: string;
    targetBranch: string;
    /** Prefix that turns a repository path into a web link, such as `<host>/<owner>/<repo>/blob/main`. Omit in a public project whose tickets must not link it. */
    webUrl?: string;
    /** Appended to each commit subject, such as ` (#{ticket})`; omit when commits must not carry ticket numbers. */
    commitSuffix?: string;
    /** How a unit lands: the command that publishes its commits, such as `git push origin HEAD:main`, or exactly `pull request` to follow the project's pull-request workflow. */
    land: string;
  };
  /** Project instruction files every unit reads, repository-relative. */
  instructions: string[];
  design: {
    /** Directory of the redesign proposals (`<key>.md`). */
    proposals: string;
    /** Directory of the wireframe pages (`<key>.html`). */
    wireframes: string;
    /** The shared UX pattern reference. */
    patterns: string;
    /** Further design rules the blind reviewers read with the pattern reference, such as a component library's usage rules. */
    rules?: string[];
  };
  /** Where the code lives, as label to repository-relative path. */
  source: Record<string, string>;
  worktree: {
    /** Directory holding unit worktrees, repository-relative. */
    dir: string;
    /** Commands that prepare a new worktree, run in order inside it. */
    setup: string[];
    /** Command that reinstalls dependencies from the lockfile. */
    reinstall?: string;
    /** Caches to delete after setup and after a rebase that changes the lockfile, worktree-relative. */
    caches?: string[];
  };
  preview: {
    /** Command that starts the app for one unit, run in its worktree. */
    start: string;
    /** The unit's own preview host label or port. */
    host: string;
    /** Instructions to read before starting a preview. */
    guide?: string;
    /** Selectors of development overlays hidden before screenshots and left out of audits. */
    overlays?: string[];
    /** How to seed realistic data. */
    seed?: string;
    /** Other facts about running a unit's preview, such as how its own host is selected. */
    notes?: string;
  };
  checks: {
    /** How to run targeted tests for changed code while iterating. */
    targeted: string[];
    /** The final gate before landing: the tests the whole change affects against its base, run once. */
    final: string;
    /** The coverage command, when the final gate does not include it. */
    coverage?: string;
  };
  /** A shared component library released before the app uses its changes. */
  library?: {
    name: string;
    /** Its checkout, repository-relative, absolute or under `~`. */
    repository: string;
    /** Where its release recipe is documented. */
    release: string;
  };
  deploy?: {
    /** The production URL of the app. */
    url: string;
    /** Commands that deploy the landed revision, in order. */
    commands: string[];
    /** Where deployment runs and what it needs. */
    where: string;
    /** How a browser reaches production, when it is behind authentication. */
    access?: string;
  };
  qa: {
    /** The main screens of the persistent chrome review, as paths under the app's base URL. */
    screens: { name: string; path: string }[];
  };
  /** The volume holding worktrees, dependency stores and build output. */
  disk: { volume: string };
  /** Machine-local directory for screenshots and other bulky evidence; `~` allowed. */
  localDir: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);

type Check = (value: unknown) => boolean;
const STRING: Check = isString;
const STRINGS: Check = isStrings;
const NONEMPTY_STRINGS: Check = (value) => isStrings(value) && value.length > 0;

/** Required (`true`) and optional (`false`) fields per section, with their checks. */
const SCHEMA: Record<string, Record<string, [Check, boolean]> | [Check, boolean]> = {
  product: [STRING, true],
  tracker: { project: [STRING, true], labels: [STRINGS, true] },
  repository: {
    remote: [STRING, true],
    targetBranch: [STRING, true],
    webUrl: [STRING, false],
    commitSuffix: [(value) => typeof value === "string", false],
    land: [STRING, true],
  },
  instructions: [NONEMPTY_STRINGS, true],
  design: { proposals: [STRING, true], wireframes: [STRING, true], patterns: [STRING, true], rules: [STRINGS, false] },
  source: [(value) => isRecord(value) && Object.keys(value).length > 0 && Object.values(value).every(isString), true],
  worktree: {
    dir: [STRING, true],
    setup: [NONEMPTY_STRINGS, true],
    reinstall: [STRING, false],
    caches: [STRINGS, false],
  },
  preview: {
    start: [STRING, true],
    host: [STRING, true],
    guide: [STRING, false],
    overlays: [STRINGS, false],
    seed: [STRING, false],
    notes: [STRING, false],
  },
  checks: { targeted: [NONEMPTY_STRINGS, true], final: [STRING, true], coverage: [STRING, false] },
  library: { name: [STRING, true], repository: [STRING, true], release: [STRING, true] },
  deploy: { url: [STRING, true], commands: [NONEMPTY_STRINGS, true], where: [STRING, true], access: [STRING, false] },
  qa: {
    screens: [
      (value) =>
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((screen) => isRecord(screen) && isString(screen.name) && isString(screen.path)),
      true,
    ],
  },
  disk: { volume: [STRING, true] },
  localDir: [STRING, true],
};
const OPTIONAL_SECTIONS = new Set(["library", "deploy"]);

/** Every problem with a parsed config, as `<field>: <problem>` lines; empty when it is valid. */
export function configProblems(value: unknown): string[] {
  if (!isRecord(value)) return ["config: expected a JSON object"];
  const problems: string[] = [];
  for (const key of Object.keys(value)) if (!(key in SCHEMA)) problems.push(`${key}: unknown field`);
  for (const [key, rule] of Object.entries(SCHEMA)) {
    const field = value[key];
    if (Array.isArray(rule)) {
      const [check, required] = rule;
      if (field === undefined) {
        if (required) problems.push(`${key}: missing`);
      } else if (!check(field)) problems.push(`${key}: invalid value`);
      continue;
    }
    if (field === undefined) {
      if (!OPTIONAL_SECTIONS.has(key)) problems.push(`${key}: missing`);
      continue;
    }
    if (!isRecord(field)) {
      problems.push(`${key}: expected an object`);
      continue;
    }
    for (const inner of Object.keys(field)) if (!(inner in rule)) problems.push(`${key}.${inner}: unknown field`);
    for (const [inner, [check, required]] of Object.entries(rule)) {
      if (field[inner] === undefined) {
        if (required) problems.push(`${key}.${inner}: missing`);
      } else if (!check(field[inner])) problems.push(`${key}.${inner}: invalid value`);
    }
  }
  return problems;
}

const isProjectConfig = (value: unknown): value is ProjectConfig => configProblems(value).length === 0;

export function parseConfig(text: string, source = "config"): ProjectConfig {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`${source}: not valid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
  if (isProjectConfig(value)) return value;
  throw new Error(
    `${source} is invalid:\n${configProblems(value)
      .map((line) => `  ${line}`)
      .join("\n")}`,
  );
}

/**
 * The main checkout of the repository holding `path`, also when `path` lies in a linked worktree: units create their
 * worktrees from it, and sibling checkouts such as a component library resolve against it.
 */
export function repositoryRoot(path: string): string {
  const result = Bun.spawnSync(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: dirname(resolve(path)),
    env: { ...process.env },
  });
  if (result.exitCode !== 0) throw new Error(`${path} is not inside a Git repository`);
  return dirname(result.stdout.toString().trim());
}

/** Resolves `~`, absolute and repository-relative paths to absolute ones. */
export function resolvePath(root: string, path: string): string {
  if (path === "~" || path.startsWith("~/")) return join(homedir(), path.slice(1));
  return isAbsolute(path) ? path : resolve(root, path);
}

export interface LoadedConfig {
  config: ProjectConfig;
  /** Absolute path of the config file. */
  path: string;
  /** The main checkout of the repository holding the config. */
  root: string;
  /** The run's state directory: the parent of the config's `implementation/` directory. */
  state: string;
}

export function loadConfig(path: string): LoadedConfig {
  const absolute = resolve(path);
  const config = parseConfig(readFileSync(absolute, "utf8"), absolute);
  return { config, path: absolute, root: repositoryRoot(absolute), state: dirname(dirname(absolute)) };
}
