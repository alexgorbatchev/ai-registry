import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePath, type LoadedConfig } from "./config";

/** Free disk, in GiB, below which a unit starts no new work. */
export const DISK_FLOOR_GIB = 8;

export type TemplateValues = Record<string, string | undefined>;

/**
 * Fills `{{name}}` placeholders and keeps `{{#name}}…{{/name}}` sections only when `name` has a value.
 * Throws on a placeholder with no value outside such a section, so a brief never ships with a hole.
 */
export function fillTemplate(template: string, values: TemplateValues): string {
  const keep = (_match: string, name: string, body: string) => (values[name] ? body : "");
  // Block sections, whose markers sit on their own lines, take their lines with them; inline sections keep the line.
  const withSections = template
    .replace(/^\{\{#(\w+)\}\}\n([\s\S]*?)^\{\{\/\1\}\}\n/gm, keep)
    .replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, keep);
  const missing = new Set<string>();
  const filled = withSections.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = values[name];
    if (value === undefined || value === "") {
      missing.add(name);
      return match;
    }
    return value;
  });
  if (missing.size > 0) throw new Error(`no value for ${[...missing].map((name) => `{{${name}}}`).join(", ")}`);
  return filled;
}

const code = (value: string): string => `\`${value}\``;
/** `a`, `b` and `c` */
export function codeList(values: string[], conjunction = "and"): string {
  const items = values.map(code);
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;
}
const bullets = (values: string[]): string => values.map((value) => `   - ${value}`).join("\n");

export interface BriefInput {
  loaded: LoadedConfig;
  unit: string;
  tickets: number[];
  /** The skill's directory, for script and reference paths. */
  skill: string;
}

/** The run's epic, from the slice record `file-slices.ts` keeps. */
export function recordedEpic(state: string): number | null {
  const path = join(state, "implementation", "slices.json");
  if (!existsSync(path)) return null;
  const record: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof record !== "object" || record === null || !("epic" in record)) return null;
  return typeof record.epic === "number" ? record.epic : null;
}

/** Every value the unit brief template uses, resolved for one unit. */
export function briefValues({ loaded, unit, tickets, skill }: BriefInput): TemplateValues {
  const { config, root, state } = loaded;
  const unitTokens = (value: string) => value.replaceAll("{unit}", unit).replaceAll("{ticket}", "<ticket>");
  const epic = recordedEpic(state);
  const local = resolvePath(root, config.localDir);
  const land = config.repository.land;
  return {
    unit,
    tickets: tickets.map((ticket) => `#${ticket}`).join(", then "),
    product: config.product,
    repo: root,
    state,
    checkpoint: join(local, "units", `${unit}.json`),
    skill,
    visualQa: join(skill, "references", "visual-qa.md"),
    epic: epic === null ? "the run's epic" : `epic #${epic}`,
    trackerProject: config.tracker.project,
    instructions: codeList(config.instructions),
    proposals: config.design.proposals,
    wireframes: config.design.wireframes,
    patterns: config.design.patterns,
    source: Object.entries(config.source)
      .map(([label, path]) => `${label} in ${code(path)}`)
      .join(", "),
    remote: config.repository.remote,
    targetBranch: config.repository.targetBranch,
    worktreeDir: config.worktree.dir,
    setup: codeList(config.worktree.setup.map(unitTokens), "then"),
    reinstall: config.worktree.reinstall,
    caches: config.worktree.caches?.length ? codeList(config.worktree.caches) : undefined,
    previewStart: unitTokens(config.preview.start),
    previewHost: unitTokens(config.preview.host),
    previewGuide: config.preview.guide,
    overlays: config.preview.overlays?.length ? codeList(config.preview.overlays) : undefined,
    ignoreFlags: (config.preview.overlays ?? []).map((selector) => ` --ignore '${selector}'`).join(""),
    seed: config.preview.seed,
    previewNotes: config.preview.notes ? unitTokens(config.preview.notes) : undefined,
    targeted: bullets(config.checks.targeted.map(unitTokens)),
    final: config.checks.final,
    coverage: config.checks.coverage,
    libraryName: config.library?.name,
    libraryRepository: config.library ? resolvePath(root, config.library.repository) : undefined,
    libraryRelease: config.library?.release,
    land:
      land === "pull request"
        ? "open a pull request and merge it through the project's pull-request workflow"
        : `run \`${unitTokens(land)}\``,
    commitSuffix: config.repository.commitSuffix ? unitTokens(config.repository.commitSuffix) : undefined,
    diskVolume: config.disk.volume,
    diskFloor: String(DISK_FLOOR_GIB),
    shots: join(local, "shots", unit),
  };
}

export const BRIEF_TEMPLATE = join(import.meta.dir, "..", "..", "assets", "unit-brief.md");

/** Numbers top-level ordered-list items consecutively, closing the gaps that dropped sections leave. */
export function renumber(text: string): string {
  let next = 0;
  return text.replace(/^\d+\. /gm, () => `${++next}. `);
}

export function renderBrief(input: BriefInput, template = readFileSync(BRIEF_TEMPLATE, "utf8")): string {
  return renumber(fillTemplate(template, briefValues(input)));
}
