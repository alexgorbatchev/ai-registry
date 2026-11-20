import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LoadedConfig } from "./config";

/** `<state>/implementation/slices-plan.json`: which proposals to slice and the waits the proposals state in prose. */
export interface SlicePlan {
  epic: {
    title: string;
    /** The epic body (the queue mandate), relative to the plan's directory. */
    body: string;
    /** Further existing tickets the epic gets, besides every redesign named below. */
    add?: number[];
  };
  /** Default priority of slice tickets, `P0`–`P3`. */
  priority: string;
  /** One entry per redesigned flow whose proposal lists its slices. */
  flows: { key: string; redesign: number; prefix: string }[];
  /** Cross-flow waits by slice key: other slice keys (`<prefix>-<n>`), suite keys, or existing tickets (`#<n>`). */
  blockers?: Record<string, string[]>;
  /** Journey suites: one ticket per journey proposal, blocked by the slices it exercises. */
  suites?: { key: string; flow: string; redesign: number; title: string; blockedBy: string[]; priority?: string }[];
}

/** `<state>/implementation/slices.json`: what has been filed, so reruns file nothing twice. */
export interface SliceRecord {
  epic: number | null;
  slices: Record<string, { number: number; parent: number }>;
}

export interface Slice {
  key: string;
  flow: string;
  parent: number;
  title: string;
  body: string;
  blockedBy: string[];
  priority: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const PRIORITY = /^P[0-3]$/;

export function planProblems(value: unknown): string[] {
  if (!isRecord(value)) return ["plan: expected a JSON object"];
  const problems: string[] = [];
  const epic = value.epic;
  if (!isRecord(epic) || typeof epic.title !== "string" || typeof epic.body !== "string") {
    problems.push("epic: needs title and body");
  } else if (epic.add !== undefined && !(Array.isArray(epic.add) && epic.add.every(Number.isInteger))) {
    problems.push("epic.add: expected ticket numbers");
  }
  if (typeof value.priority !== "string" || !PRIORITY.test(value.priority)) problems.push("priority: expected P0-P3");
  const flows = value.flows;
  if (!Array.isArray(flows) || flows.length === 0) problems.push("flows: expected at least one flow");
  else
    flows.forEach((flow, i) => {
      if (
        !isRecord(flow) ||
        typeof flow.key !== "string" ||
        !Number.isInteger(flow.redesign) ||
        typeof flow.prefix !== "string"
      )
        problems.push(`flows[${i}]: needs key, redesign and prefix`);
    });
  if (
    value.blockers !== undefined &&
    !(
      isRecord(value.blockers) &&
      Object.values(value.blockers).every((refs) => Array.isArray(refs) && refs.every((ref) => typeof ref === "string"))
    )
  )
    problems.push("blockers: expected slice keys mapped to lists of references");
  if (value.suites !== undefined) {
    if (!Array.isArray(value.suites)) problems.push("suites: expected a list");
    else
      value.suites.forEach((suite, i) => {
        if (
          !isRecord(suite) ||
          typeof suite.key !== "string" ||
          typeof suite.flow !== "string" ||
          !Number.isInteger(suite.redesign) ||
          typeof suite.title !== "string" ||
          !Array.isArray(suite.blockedBy) ||
          (suite.priority !== undefined && !(typeof suite.priority === "string" && PRIORITY.test(suite.priority)))
        )
          problems.push(`suites[${i}]: needs key, flow, redesign, title and blockedBy, and a P0-P3 priority if any`);
      });
  }
  return problems;
}

const isPlan = (value: unknown): value is SlicePlan => planProblems(value).length === 0;

export function parsePlan(text: string, source = "plan"): SlicePlan {
  const value: unknown = JSON.parse(text);
  if (isPlan(value)) return value;
  throw new Error(
    `${source} is invalid:\n${planProblems(value)
      .map((line) => `  ${line}`)
      .join("\n")}`,
  );
}

export interface ProposalSlices {
  title: string;
  /** The whole "Recommended priority" section, trimmed. */
  section: string;
  items: { n: number; name: string; rest: string }[];
  /** The paragraph starting with "Seams", or "" when the proposal has none. */
  seams: string;
}

/** Reads a proposal's title and its numbered delivery slices from its "Recommended priority" section. */
export function parseProposal(text: string, source = "proposal"): ProposalSlices {
  const title = /^# (.+?): proposed/m.exec(text)?.[1];
  if (!title) throw new Error(`${source}: no "# <Flow title>: proposed experience" heading`);
  const start = /^## Recommended priority[ \t]*$/m.exec(text);
  if (!start) throw new Error(`${source}: no "## Recommended priority" section`);
  const after = text.slice(start.index + start[0].length);
  const end = /^## /m.exec(after);
  const section = (end ? after.slice(0, end.index) : after).trim();
  const items = [...section.matchAll(/^(\d+)\. \*\*(.+?)\*\*(.*)$/gm)].map(([, n, name, rest]) => ({
    n: Number(n),
    name,
    rest,
  }));
  const seams = /^Seams[\s\S]*?(?=\n\s*\n|$)/m.exec(section)?.[0] ?? "";
  return { title, section, items, seams };
}

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
/** "A touch-safe viewer (library work)." -> "A touch-safe viewer" */
export const shortName = (name: string): string => name.replace(/\s*\(.*$/s, "").replace(/\.$/, "");

function link(loaded: LoadedConfig, path: string): string {
  const base = loaded.config.repository.webUrl;
  return base ? `${base.replace(/\/$/, "")}/${path}` : `\`${path}\``;
}

function deliveryLines(loaded: LoadedConfig): string[] {
  const { config } = loaded;
  return [
    ...(config.library
      ? [`- Changes to ${config.library.name} are released first and this app moves to that release.`]
      : []),
    "- Before and after screenshots at 320, 390 and 1440 px in both themes for every UI change, reviewed blind before acceptance; behavioral tests under the project's coverage policy; the project's final verification once before landing.",
    `- Lands on \`${config.repository.targetBranch}\`${config.deploy ? "; deployed to production and verified there before closing" : ""}.`,
  ];
}

/** Every slice ticket the plan and the proposals describe, in plan order. */
export function buildSlices(loaded: LoadedConfig, plan: SlicePlan, readProposal: (flow: string) => string): Slice[] {
  const { config } = loaded;
  const design = config.design;
  const slices: Slice[] = [];
  for (const flow of plan.flows) {
    const proposal = parseProposal(readProposal(flow.key), `${flow.key}.md`);
    if (proposal.items.length === 0) throw new Error(`${flow.key}.md: "Recommended priority" lists no numbered slices`);
    for (const { n, name, rest } of proposal.items) {
      const key = `${flow.prefix}-${n}`;
      const body = [
        `Delivery slice ${n} of the redesign #${flow.redesign} ("${proposal.title}"). The redesign ticket holds the acceptance criteria; this slice delivers the criteria that cite the rules and tickets named below and leaves the rest to later slices.`,
        "",
        "## Slice",
        "",
        `**${name}**${rest}`,
        "",
        "## Design",
        "",
        `- Proposal: ${link(loaded, `${design.proposals}/${flow.key}.md`)} (section "Recommended priority" and the steps and criteria citing these rules)`,
        `- Wireframe: ${link(loaded, `${design.wireframes}/${flow.key}.html`)}`,
        `- Shared rules: ${link(loaded, design.patterns)}`,
        "",
        ...(proposal.seams ? ["## Seams", "", proposal.seams, ""] : []),
        "## Delivery",
        "",
        ...deliveryLines(loaded),
      ].join("\n");
      slices.push({
        key,
        flow: flow.key,
        parent: flow.redesign,
        title: `${config.product} ${lowerFirst(proposal.title)}: ${shortName(name)}`,
        body,
        blockedBy: [...(n > 1 ? [`${flow.prefix}-${n - 1}`] : []), ...(plan.blockers?.[key] ?? [])],
        priority: plan.priority,
      });
    }
  }
  for (const suite of plan.suites ?? []) {
    const proposal = parseProposal(readProposal(suite.flow), `${suite.flow}.md`);
    slices.push({
      key: suite.key,
      flow: suite.flow,
      parent: suite.redesign,
      title: suite.title,
      blockedBy: suite.blockedBy,
      priority: suite.priority ?? plan.priority,
      body: [
        `The journey's own delivery for the redesign #${suite.redesign}: the end-to-end suite that exercises its acceptance criteria as the flow slices land.`,
        "",
        "## Slices and order",
        "",
        proposal.section,
        "",
        `- Proposal: ${link(loaded, `${design.proposals}/${suite.flow}.md`)}`,
      ].join("\n"),
    });
  }
  const keys = new Set(slices.map((slice) => slice.key));
  if (keys.size !== slices.length) throw new Error("two slices share a key; give each flow its own prefix");
  for (const key of Object.keys(plan.blockers ?? {}))
    if (!keys.has(key)) throw new Error(`blockers: no slice "${key}"`);
  for (const slice of slices)
    for (const ref of slice.blockedBy)
      if (!/^#\d+$/.test(ref) && !keys.has(ref)) throw new Error(`${slice.key}: unknown blocker "${ref}"`);
  return slices;
}

/** Runs one issue-tracker command with AGENT=1 and returns its output; throws on a non-zero exit. */
export type TrackerRunner = (args: string[], stdin?: string) => string;

export const runIssueTracker: TrackerRunner = (args, stdin) => {
  const result = Bun.spawnSync(["issue-tracker", ...args], {
    env: { ...process.env, AGENT: "1" },
    stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
  });
  const output = `${result.stdout.toString()}${result.stderr.toString()}`;
  if (result.exitCode !== 0) throw new Error(`issue-tracker ${args.slice(0, 2).join(" ")} failed: ${output.trim()}`);
  return output;
};

export function readRecord(path: string): SliceRecord {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { epic: null, slices: {} };
}

export interface FileOptions {
  loaded: LoadedConfig;
  plan: SlicePlan;
  /** The plan's directory, which holds the epic body and the record. */
  dir: string;
  slices: Slice[];
  run?: TrackerRunner;
  log?: (line: string) => void;
}

/**
 * Creates the epic once, then files every unfiled slice in dependency order (a slice is filed once all its blockers
 * exist), saving the record after every ticket so an interrupted run resumes where it stopped.
 */
export function fileSlices({
  loaded,
  plan,
  dir,
  slices,
  run = runIssueTracker,
  log = console.log,
}: FileOptions): SliceRecord {
  const recordPath = join(dir, "slices.json");
  const record = readRecord(recordPath);
  const save = () => writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  const project = loaded.config.tracker.project;
  if (record.epic === null) {
    const redesigns = [
      ...new Set([
        ...plan.flows.map((flow) => flow.redesign),
        ...(plan.suites ?? []).map((suite) => suite.redesign),
        ...(plan.epic.add ?? []),
      ]),
    ];
    const output = run(
      [
        "epic",
        "create",
        "--project",
        project,
        "--title",
        plan.epic.title,
        "--body-file",
        "-",
        ...redesigns.flatMap((ticket) => ["--add", String(ticket)]),
      ],
      readFileSync(join(dir, plan.epic.body), "utf8"),
    );
    const epic = /created epic #(\d+)/.exec(output)?.[1];
    if (!epic) throw new Error(`epic create printed no epic number: ${output.trim()}`);
    record.epic = Number(epic);
    save();
    log(`OK epic -> #${record.epic}`);
  }
  const resolve = (ref: string): number | undefined =>
    ref.startsWith("#") ? Number(ref.slice(1)) : record.slices[ref]?.number;
  let pending = slices.filter((slice) => !record.slices[slice.key]);
  while (pending.length > 0) {
    const ready = pending.filter((slice) => slice.blockedBy.every((ref) => resolve(ref) !== undefined));
    if (ready.length === 0) throw new Error(`dependency cycle among ${pending.map((slice) => slice.key).join(", ")}`);
    for (const slice of ready) {
      const output = run(
        [
          "issue",
          "create",
          "--project",
          project,
          "--title",
          slice.title,
          "--body-file",
          "-",
          "--epic",
          String(record.epic),
          ...[...loaded.config.tracker.labels, `priority:${slice.priority}`].flatMap((label) => ["--label", label]),
          ...slice.blockedBy.flatMap((ref) => ["--blocked-by", String(resolve(ref))]),
          "--blocking",
          String(slice.parent),
          "--discovered-from",
          String(slice.parent),
        ],
        slice.body,
      );
      const number = /created #(\d+)/.exec(output)?.[1];
      if (!number) throw new Error(`issue create printed no ticket number for ${slice.key}: ${output.trim()}`);
      record.slices[slice.key] = { number: Number(number), parent: slice.parent };
      save();
      log(`OK ${slice.key} -> #${number}`);
    }
    pending = pending.filter((slice) => !record.slices[slice.key]);
  }
  return record;
}
