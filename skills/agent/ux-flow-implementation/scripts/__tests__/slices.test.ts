import { describe, expect, test } from "bun:test";
import { chmodSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, type LoadedConfig } from "../lib/config";
import {
  buildSlices,
  fileSlices,
  parsePlan,
  parseProposal,
  planProblems,
  readRecord,
  shortName,
  type SlicePlan,
  type TrackerRunner,
} from "../lib/slices";
import {
  factory_cli,
  factory_config,
  factory_file,
  factory_project,
  factory_proposal,
  factory_testDirectory,
} from "./fixtures";

const PROPOSALS: Record<string, string> = {
  "export-reports": factory_proposal(
    "Export reports",
    ["Safe export (library work).", "Undo"],
    "Seams: undo comes from history (`UNDO-1`).",
  ),
  "share-reports": factory_proposal("Share reports", ["Links"]),
  "journey-weekly": factory_proposal("Weekly journey", ["Export first", "Then share"]),
};

const PLAN: SlicePlan = {
  epic: { title: "Reports UX rework", body: "epic.md", add: [9] },
  priority: "P1",
  flows: [
    { key: "export-reports", redesign: 101, prefix: "export" },
    { key: "share-reports", redesign: 102, prefix: "share" },
  ],
  blockers: { "share-1": ["export-1", "#50"] },
  suites: [
    {
      key: "weekly-suite",
      flow: "journey-weekly",
      redesign: 103,
      title: "Reports weekly journey suite",
      blockedBy: ["export-2", "share-1"],
      priority: "P2",
    },
  ],
};

function project(name: string): { loaded: LoadedConfig; dir: string } {
  const root = realpathSync(factory_testDirectory(name));
  const { configPath } = factory_project(root);
  for (const [key, text] of Object.entries(PROPOSALS))
    factory_file(join(root, "app/docs/ux-flows/proposals", `${key}.md`), text);
  const dir = join(configPath, "..");
  factory_file(join(dir, "slices-plan.json"), JSON.stringify(PLAN));
  factory_file(join(dir, "epic.md"), "## Queue mandate\n");
  return { loaded: loadConfig(configPath), dir };
}

/** Records tracker calls and answers like issue-tracker, numbering tickets from 200. */
function tracker(): { calls: { args: string[]; stdin?: string }[]; run: TrackerRunner } {
  const calls: { args: string[]; stdin?: string }[] = [];
  let next = 200;
  return {
    calls,
    run: (args, stdin) => {
      calls.push({ args, stdin });
      return args[0] === "epic" ? "OK: created epic #150\n" : `OK: created #${next++}\n`;
    },
  };
}

describe("parseProposal", () => {
  test("reads the title, the numbered slices and the seams of the priority section only", () => {
    const proposal = parseProposal(PROPOSALS["export-reports"]);
    expect(proposal.title).toBe("Export reports");
    expect(proposal.items).toEqual([
      { n: 1, name: "Safe export (library work).", rest: " Detail of slice 1." },
      { n: 2, name: "Undo", rest: " Detail of slice 2." },
    ]);
    expect(proposal.seams).toBe("Seams: undo comes from history (`UNDO-1`).");
    expect(proposal.section).not.toContain("Later section");
  });

  test("names the missing heading or section", () => {
    expect(() => parseProposal("no title", "x.md")).toThrow('x.md: no "# <Flow title>: proposed experience"');
    expect(() => parseProposal("# A: proposed experience\n", "x.md")).toThrow('no "## Recommended priority"');
    expect(parseProposal("# A: proposed experience\n## Recommended priority\n\n1. **Only** one.").seams).toBe("");
  });

  test("shortens slice names", () => {
    expect(shortName("A touch-safe viewer (library work, then the app).")).toBe("A touch-safe viewer");
    expect(shortName("Undo.")).toBe("Undo");
  });
});

describe("plans", () => {
  test("accept a valid plan and name each problem in an invalid one", () => {
    expect(planProblems(PLAN)).toEqual([]);
    expect(planProblems(null)).toEqual(["plan: expected a JSON object"]);
    expect(
      planProblems({
        epic: { title: "t", body: "b", add: ["x"] },
        priority: "P9",
        flows: [{ key: "k" }],
        blockers: { a: [1] },
        suites: [{ key: "s" }],
      }),
    ).toEqual([
      "epic.add: expected ticket numbers",
      "priority: expected P0-P3",
      "flows[0]: needs key, redesign and prefix",
      "blockers: expected slice keys mapped to lists of references",
      "suites[0]: needs key, flow, redesign, title and blockedBy, and a P0-P3 priority if any",
    ]);
    expect(planProblems({ epic: {}, priority: "P1", flows: [], suites: {} })).toEqual([
      "epic: needs title and body",
      "flows: expected at least one flow",
      "suites: expected a list",
    ]);
    expect(() => parsePlan("{}", "plan.json")).toThrow("plan.json is invalid");
  });
});

describe("buildSlices", () => {
  test("builds one slice per numbered item, chained within a flow, plus the suites", () => {
    const { loaded } = project("slices-build");
    const slices = buildSlices(loaded, PLAN, (flow) => PROPOSALS[flow]);
    expect(slices.map((slice) => [slice.key, slice.parent, slice.blockedBy, slice.priority])).toEqual([
      ["export-1", 101, [], "P1"],
      ["export-2", 101, ["export-1"], "P1"],
      ["share-1", 102, ["export-1", "#50"], "P1"],
      ["weekly-suite", 103, ["export-2", "share-1"], "P2"],
    ]);
    expect(slices[0].title).toBe("Reports export reports: Safe export");
    expect(slices[0].body).toContain('Delivery slice 1 of the redesign #101 ("Export reports")');
    expect(slices[0].body).toContain(
      "- Proposal: https://git.example/acme/reports/blob/main/app/docs/ux-flows/proposals/export-reports.md",
    );
    expect(slices[0].body).toContain("## Seams\n\nSeams: undo comes from history");
    expect(slices[0].body).toContain("Changes to @acme/ui are released first");
    expect(slices[0].body).toContain("deployed to production and verified there");
    expect(slices[2].body).not.toContain("## Seams\n\nSeams: undo");
    expect(slices[3].body).toContain("1. **Export first**");
  });

  test("writes repository paths when the project has no web URL, and no deploy or library lines it lacks", () => {
    const { loaded } = project("slices-paths");
    const { library: _library, deploy: _deploy, ...config } = factory_config();
    const bare = { ...loaded, config: { ...config, repository: { ...config.repository, webUrl: undefined } } };
    const [slice] = buildSlices(bare, PLAN, (flow) => PROPOSALS[flow]);
    expect(slice.body).toContain("- Proposal: `app/docs/ux-flows/proposals/export-reports.md`");
    expect(slice.body).not.toContain("released first");
    expect(slice.body).not.toContain("production");
  });

  test("rejects unknown blockers, unknown blocker keys, shared prefixes and empty slice lists", () => {
    const { loaded } = project("slices-invalid");
    const read = (flow: string) => PROPOSALS[flow];
    expect(() => buildSlices(loaded, { ...PLAN, blockers: { "share-1": ["nope-1"] } }, read)).toThrow(
      'share-1: unknown blocker "nope-1"',
    );
    expect(() => buildSlices(loaded, { ...PLAN, blockers: { "nope-9": [] } }, read)).toThrow(
      'blockers: no slice "nope-9"',
    );
    const twice = { ...PLAN, flows: [PLAN.flows[0], { ...PLAN.flows[0], redesign: 104 }] };
    expect(() => buildSlices(loaded, twice, read)).toThrow("two slices share a key");
    expect(() =>
      buildSlices(loaded, PLAN, () => "# A: proposed experience\n## Recommended priority\n\nprose only"),
    ).toThrow("lists no numbered slices");
  });
});

describe("fileSlices", () => {
  test("creates the epic once, files in dependency order, and records every ticket as it goes", () => {
    const { loaded, dir } = project("slices-file");
    const slices = buildSlices(loaded, PLAN, (flow) => PROPOSALS[flow]);
    const lines: string[] = [];
    const first = tracker();
    const record = fileSlices({ loaded, plan: PLAN, dir, slices, run: first.run, log: (line) => lines.push(line) });
    expect(record.epic).toBe(150);
    expect(first.calls[0].args).toEqual([
      "epic",
      "create",
      "--project",
      "acme/reports",
      "--title",
      "Reports UX rework",
      "--body-file",
      "-",
      "--add",
      "101",
      "--add",
      "102",
      "--add",
      "103",
      "--add",
      "9",
    ]);
    expect(first.calls[0].stdin).toBe("## Queue mandate\n");
    const filed = first.calls.slice(1).map((call) => call.args[call.args.indexOf("--title") + 1]);
    expect(filed).toEqual([
      "Reports export reports: Safe export",
      "Reports export reports: Undo",
      "Reports share reports: Links",
      "Reports weekly journey suite",
    ]);
    const share = first.calls[3].args;
    expect(share).toEqual(
      expect.arrayContaining([
        "--epic",
        "150",
        "--label",
        "ux",
        "--label",
        "priority:P1",
        "--blocking",
        "102",
        "--discovered-from",
        "102",
      ]),
    );
    expect(share.filter((arg, i) => share[i - 1] === "--blocked-by")).toEqual(["200", "50"]);
    expect(first.calls[4].args).toContain("priority:P2");
    expect(lines).toEqual([
      "OK epic -> #150",
      "OK export-1 -> #200",
      "OK export-2 -> #201",
      "OK share-1 -> #202",
      "OK weekly-suite -> #203",
    ]);
    expect(readRecord(join(dir, "slices.json")).slices["share-1"]).toEqual({ number: 202, parent: 102 });

    const again = tracker();
    fileSlices({ loaded, plan: PLAN, dir, slices, run: again.run, log: () => undefined });
    expect(again.calls).toEqual([]);
  });

  test("keeps what was filed when the tracker fails, and reports cycles and unreadable output", () => {
    const { loaded, dir } = project("slices-fail");
    const slices = buildSlices(loaded, PLAN, (flow) => PROPOSALS[flow]);
    let count = 0;
    const failing: TrackerRunner = (args) => {
      if (args[0] === "epic") return "OK: created epic #150";
      if (++count > 1) throw new Error("tracker down");
      return "OK: created #300";
    };
    expect(() => fileSlices({ loaded, plan: PLAN, dir, slices, run: failing, log: () => undefined })).toThrow(
      "tracker down",
    );
    expect(Object.keys(readRecord(join(dir, "slices.json")).slices)).toEqual(["export-1"]);

    const cyclic = slices.map((slice) =>
      slice.key === "export-2" ? { ...slice, blockedBy: ["weekly-suite"] } : slice,
    );
    expect(() =>
      fileSlices({ loaded, plan: PLAN, dir, slices: cyclic, run: tracker().run, log: () => undefined }),
    ).toThrow("dependency cycle among export-2");
    const { dir: fresh } = project("slices-garbled");
    expect(() =>
      fileSlices({ loaded, plan: PLAN, dir: fresh, slices, run: () => "nothing", log: () => undefined }),
    ).toThrow("epic create printed no epic number");
    const { dir: fresh2 } = project("slices-garbled-issue");
    const garbled: TrackerRunner = (args) => (args[0] === "epic" ? "OK: created epic #1" : "nothing");
    expect(() => fileSlices({ loaded, plan: PLAN, dir: fresh2, slices, run: garbled, log: () => undefined })).toThrow(
      "issue create printed no ticket number for export-1",
    );
  });
});

describe("file-slices CLI", () => {
  test("lists the slices without filing, files through issue-tracker with --apply, and rejects bad input", async () => {
    const { loaded, dir } = project("slices-cli");
    const listing = await factory_cli("file-slices.ts", ["--config", loaded.path]);
    expect(listing.code).toBe(0);
    expect(listing.stdout.split("\n")[0]).toBe(
      "export-1\tunfiled\t#101\tReports export reports: Safe export\tblocked by -",
    );

    const bin = factory_testDirectory("fake-tracker");
    const log = join(bin, "calls.log");
    const fake = factory_file(
      join(bin, "issue-tracker"),
      `#!/bin/sh\necho "$AGENT $*" >> "${log}"\ncat > /dev/null\ncase "$1" in epic) echo "OK: created epic #150";; *) echo "OK: created #$(wc -l < "${log}" | tr -d ' ')";; esac\n`,
    );
    chmodSync(fake, 0o755);
    const child = Bun.spawn(
      ["bun", join(import.meta.dir, "..", "file-slices.ts"), "--config", loaded.path, "--apply"],
      {
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(await child.exited).toBe(0);
    expect(readFileSync(log, "utf8").split("\n")[0]).toStartWith("1 epic create");
    const relisted = await factory_cli("file-slices.ts", ["--config", loaded.path]);
    expect(relisted.stdout.split("\n")[0]).toContain("export-1\t#2\t");

    expect((await factory_cli("file-slices.ts", [])).code).toBe(2);
    expect((await factory_cli("file-slices.ts", ["--nope"])).code).toBe(2);
    expect((await factory_cli("file-slices.ts", ["--help"])).code).toBe(0);
    factory_file(join(dir, "slices-plan.json"), "{}");
    const invalid = await factory_cli("file-slices.ts", ["--config", loaded.path]);
    expect(invalid.code).toBe(1);
    expect(invalid.stderr).toContain("is invalid");
  });
});
