import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { frameName, isStateSlug, MAX_STOPS, parseFrameName, QA_THEMES, QA_VIEWPORTS, scrollStops } from "../lib/matrix";
import { buildManifest, checkReview, CHECKLIST, DESIGN_ITEMS, type Manifest } from "../lib/reviewFrames";
import { factory_cli, factory_file, factory_testDirectory } from "./fixtures";

const ONE = { index: 1, count: 1 };

/** Writes every matrix cell of a state as one viewport frame, optionally leaving one out. */
function writeState(dir: string, state: string, phase: "before" | "after", skip?: string): void {
  for (const { width } of QA_VIEWPORTS)
    for (const theme of QA_THEMES) {
      const name = frameName(state, phase, width, theme, ONE);
      if (name !== skip) factory_file(join(dir, name), "png");
    }
}

const DENSITY_NOTE = "first heading 72 px from the top; column 88% of the viewport; margins 16 px";
const NOTES = {
  ...Object.fromEntries(CHECKLIST.map((item) => [item, `checked ${item} across the whole frame`])),
  density: DENSITY_NOTE,
};
/** The design-item notes a frame with findings gives for the items no finding cites. */
const CHECKED = {
  redundancy: "one control per outcome in the header and the panel",
  density: DENSITY_NOTE,
  hidden: "replies and answers show without expanding anything",
};

function manifest(count: number): Manifest {
  return {
    frames: Array.from({ length: count }, (_, i) => ({
      id: `F${i + 1}`,
      path: `/s/${i}.png`,
      state: "s",
      width: 320,
      theme: "light",
      stop: "01of01",
    })),
    missing: [],
    unnamed: [],
  };
}

describe("frame names", () => {
  test("round-trip with their scroll stop and reject other names", () => {
    const stop = { index: 2, count: 3 };
    expect(frameName("comments-panel", "after", 390, "dark", stop)).toBe("comments-panel-after-390-dark-02of03.png");
    expect(parseFrameName("comments-panel-after-390-dark-02of03.png")).toEqual({
      state: "comments-panel",
      phase: "after",
      width: 390,
      theme: "dark",
      stop,
    });
    expect(frameName("home", "before", 1440, "light", "full-static")).toBe("home-before-1440-light-full-static.png");
    expect(parseFrameName("home-before-1440-light-full-static.png")).toMatchObject({
      phase: "before",
      stop: "full-static",
    });
    for (const name of [
      "home-before-1440-light.png",
      "home-after-390-dark-00of02.png",
      "home-after-390-dark-03of02.png",
      "home-after-390-dark-1of2.png",
      "annotated.png",
    ])
      expect(parseFrameName(name)).toBeNull();
    expect(isStateSlug("comments-panel")).toBe(true);
    expect(isStateSlug("Comments panel")).toBe(false);
  });
});

describe("scrollStops", () => {
  test("takes the top, a stop per visible band between bars, and the bottom", () => {
    expect(scrollStops({ scrollHeight: 600, viewportHeight: 844, topCover: 0, bottomCover: 0 })).toEqual([0]);
    expect(scrollStops({ scrollHeight: 844, viewportHeight: 844, topCover: 0, bottomCover: 0 })).toEqual([0]);
    expect(scrollStops({ scrollHeight: 2532, viewportHeight: 844, topCover: 0, bottomCover: 0 })).toEqual([
      0, 844, 1688,
    ]);
    expect(scrollStops({ scrollHeight: 2252, viewportHeight: 844, topCover: 48, bottomCover: 64 })).toEqual([
      0, 732, 1408,
    ]);
    // Bars covering most of the viewport still advance by half a screen.
    expect(scrollStops({ scrollHeight: 1600, viewportHeight: 800, topCover: 300, bottomCover: 300 })).toEqual([
      0, 400, 800,
    ]);
  });

  test("refuses a page that needs more frames than stop numbers allow", () => {
    expect(
      scrollStops({ scrollHeight: 100 * MAX_STOPS, viewportHeight: 100, topCover: 0, bottomCover: 0 }),
    ).toHaveLength(MAX_STOPS);
    expect(() =>
      scrollStops({ scrollHeight: 100 * MAX_STOPS + 1, viewportHeight: 100, topCover: 0, bottomCover: 0 }),
    ).toThrow(`more than ${MAX_STOPS}`);
  });
});

describe("buildManifest", () => {
  test("orders a cell's stops top to bottom before its full-page image and names gaps in the stops", () => {
    const dir = factory_testDirectory("frames-stops");
    for (const { width } of QA_VIEWPORTS)
      for (const theme of QA_THEMES) {
        const stops = width === 320 && theme === "dark" ? [1, 3] : [1, 2, 3];
        for (const index of stops)
          factory_file(join(dir, frameName("queue", "after", width, theme, { index, count: 3 })), "png");
      }
    factory_file(join(dir, frameName("queue", "after", 390, "light", "full-static")), "png");
    factory_file(join(dir, frameName("queue", "after", 1440, "light", { index: 1, count: 2 })), "png");
    const result = buildManifest([dir]);
    expect(
      result.frames.filter((frame) => frame.width === 390 && frame.theme === "light").map((frame) => frame.stop),
    ).toEqual(["01of03", "02of03", "03of03", "full-static"]);
    expect(result.missing).toEqual([
      `${dir}: queue 320 dark: stops 02of03`,
      `${dir}: queue 1440 light: stops disagree on their count (2, 3)`,
    ]);
    const lone = factory_testDirectory("frames-full-only");
    factory_file(join(lone, frameName("solo", "after", 320, "light", "full-static")), "png");
    expect(buildManifest([lone]).missing).toContain(`${lone}: solo 320 light`);
  });

  test("lists after frames only, with neutral IDs, and names missing cells and unnamed files", () => {
    const one = factory_testDirectory("frames-a");
    const two = factory_testDirectory("frames-b");
    writeState(one, "home", "after");
    writeState(one, "home", "before");
    writeState(two, "panel", "after", "panel-after-320-dark-01of01.png");
    factory_file(join(two, "notes.png"), "png");
    factory_file(join(two, "readme.txt"), "text");
    const result = buildManifest([one, two]);
    expect(result.frames).toHaveLength(11);
    expect(result.frames[0]).toEqual({
      id: "F1",
      path: join(one, "home-after-1440-dark-01of01.png"),
      state: "home",
      width: 1440,
      theme: "dark",
      stop: "01of01",
    });
    expect(result.frames.every((frame) => !frame.path.includes("before"))).toBe(true);
    expect(result.missing).toEqual([`${two}: panel 320 dark`]);
    expect(result.unnamed).toEqual([join(two, "notes.png")]);
  });
});

describe("checkReview", () => {
  test("passes a review that accounts for every frame", () => {
    const review = {
      frames: {
        F1: {
          findings: [
            { where: "panel header", problem: "three rows of mismatched buttons", rule: "alignment", severity: "P1" },
          ],
          checked: CHECKED,
        },
        F2: { clean: NOTES },
      },
    };
    expect(checkReview(manifest(2), review)).toEqual({ problems: [], frames: 2, findings: 1, untriaged: 0 });
  });

  test("names unreviewed, unknown, ambiguous, thin and incomplete entries", () => {
    const review = {
      frames: {
        F1: { clean: { ...NOTES, contrast: "fine" } },
        F2: { findings: [{ where: "w", problem: "p", rule: "r", severity: "P3" }], clean: NOTES },
        F3: { findings: [{ where: "x", severity: "P7" }, "text"] },
        F9: { clean: NOTES },
      },
    };
    expect(checkReview(manifest(4), review).problems).toEqual([
      "F9: not in the manifest",
      "F1: a clean frame needs a note of at least 15 characters for contrast",
      "F2: give either a non-empty findings list or a clean justification, not both or neither",
      "F3: cite redundancy, density, hidden in a finding's rule or give a checked note of at least 15 characters for each",
      "F3 finding 1: missing problem",
      "F3 finding 1: missing rule",
      "F3 finding 1: severity must be P0-P3",
      "F3 finding 2: expected an object",
      "F4: not reviewed",
    ]);
    expect(checkReview(manifest(1), { frames: { F1: { clean: "looks fine" } } }).problems[0]).toContain(
      "for affordance, alignment",
    );
    expect(checkReview(manifest(1), { frames: { F1: { findings: [] } } }).problems[0]).toContain("not both or neither");
    expect(checkReview(manifest(1), []).problems).toEqual(["review: expected an object with a frames map"]);
  });

  test("with triage, requires a disposition and its reference on every finding", () => {
    const finding = { where: "w", problem: "p", rule: "r", severity: "P2" };
    const review = {
      frames: {
        F1: {
          findings: [
            { ...finding, disposition: "ticket", ref: "3408" },
            { ...finding, disposition: "fixed", ref: "" },
            { ...finding, disposition: "rejected", ref: "no" },
            { ...finding, disposition: "ignored" },
            { ...finding, disposition: "duplicate", ref: "3409" },
          ],
          checked: CHECKED,
        },
      },
    };
    const result = checkReview(manifest(1), review, true);
    expect(result.problems).toEqual([
      "F1 finding 2: ref must hold the fixing revision",
      "F1 finding 3: ref must hold the reason (at least 15 characters)",
      "F1 finding 4: disposition must be fixed, ticket, duplicate or rejected",
    ]);
    expect(result.untriaged).toBe(3);
    expect(checkReview(manifest(1), review, false).problems).toEqual([]);
    const ticketless = { frames: { F1: { findings: [{ ...finding, disposition: "ticket" }], checked: CHECKED } } };
    expect(checkReview(manifest(1), ticketless, true).problems).toEqual([
      "F1 finding 1: ref must hold the ticket number",
    ]);
  });

  test("makes every frame account for the design items, even one with other findings", () => {
    const contrast = { where: "panel border", problem: "1.2:1 against the panel", rule: "contrast", severity: "P1" };
    const redundant = {
      where: "comment panel actions",
      problem: "three buttons start a comment: whole page, target picker and region",
      rule: "redundancy",
      severity: "P2",
    };
    const review = {
      frames: {
        // Only contrast was looked at: the design items are unaccounted for.
        F1: { findings: [contrast] },
        // A redundancy finding covers that item; the other two need notes, and a thin one fails.
        F2: { findings: [redundant], checked: { density: DENSITY_NOTE, hidden: "fine" } },
        F3: { findings: [contrast, redundant], checked: { density: DENSITY_NOTE, hidden: CHECKED.hidden } },
      },
    };
    expect(checkReview(manifest(3), review).problems).toEqual([
      "F1: cite redundancy, density, hidden in a finding's rule or give a checked note of at least 15 characters for each",
      "F2: cite hidden in a finding's rule or give a checked note of at least 15 characters for each",
    ]);
    expect(DESIGN_ITEMS.every((item) => CHECKLIST.includes(item))).toBe(true);
    const unchecked = { frames: { F1: { clean: { ...NOTES, hidden: undefined } } } };
    expect(checkReview(manifest(1), unchecked).problems).toEqual([
      "F1: a clean frame needs a note of at least 15 characters for hidden",
    ]);
  });

  test("requires measurements in density notes and findings", () => {
    const vague = "spacing looks generous but fine";
    const review = {
      frames: {
        F1: { clean: { ...NOTES, density: vague } },
        F2: {
          findings: [{ where: "w", problem: "p", rule: "alignment", severity: "P2" }],
          checked: { ...CHECKED, density: vague },
        },
        F3: {
          findings: [
            { where: "comment badge gutter", problem: "a wide empty gutter", rule: "density", severity: "P3" },
          ],
          checked: CHECKED,
        },
        F4: {
          findings: [
            {
              where: "comment badge gutter",
              problem: "gutter 120 px wide for a 32 px badge",
              rule: "density",
              severity: "P3",
            },
          ],
          checked: { redundancy: CHECKED.redundancy, hidden: CHECKED.hidden },
        },
      },
    };
    expect(checkReview(manifest(4), review).problems).toEqual([
      "F1: the density note must give measurements in px or %",
      "F2: the density note must give measurements in px or %",
      "F3 finding 1: a density finding must give measurements in px or %",
    ]);
  });

  test("checks rule challenges and routes them to a ticket or duplicate against the rule", () => {
    const finding = {
      where: "comment thread",
      problem: "replies sit behind a collapsed '1 reply' row",
      rule: "hidden",
      severity: "P2",
      challenge: {
        rule: "threads collapse after the first comment",
        change: "show every reply in full; drop the collapse",
      },
    };
    const frame = (findings: unknown[]) => ({ F1: { findings, checked: CHECKED } });
    expect(checkReview(manifest(1), { frames: frame([finding]) }).problems).toEqual([]);
    const incomplete = [
      { ...finding, challenge: { rule: "threads collapse" } },
      { ...finding, challenge: { change: "show every reply in full" } },
      { ...finding, challenge: "the rule is wrong" },
    ];
    expect(checkReview(manifest(1), { frames: frame(incomplete) }).problems).toEqual([
      "F1 finding 1: challenge must name the design rule and the proposed change (at least 15 characters)",
      "F1 finding 2: challenge must name the design rule and the proposed change (at least 15 characters)",
      "F1 finding 3: challenge must name the design rule and the proposed change (at least 15 characters)",
    ]);
    const triaged = [
      { ...finding, disposition: "ticket", ref: "3500" },
      { ...finding, disposition: "duplicate", ref: "3501" },
      { ...finding, disposition: "rejected", ref: "the design rules require collapsed threads" },
      { ...finding, disposition: "fixed", ref: "abc1234" },
    ];
    const result = checkReview(manifest(1), { frames: frame(triaged) }, true);
    expect(result.problems).toEqual([
      "F1 finding 3: a rule challenge needs a ticket or duplicate against the rule's owner, not rejected",
      "F1 finding 4: a rule challenge needs a ticket or duplicate against the rule's owner, not fixed",
    ]);
    expect(result.untriaged).toBe(2);
  });
});

describe("review-frames CLI", () => {
  test("writes a manifest, fails on a missing cell, and checks reviews", async () => {
    const shots = factory_testDirectory("frames-cli");
    const work = factory_testDirectory("frames-out");
    writeState(shots, "home", "after");
    const out = join(work, "manifest.json");
    const made = await factory_cli("review-frames.ts", ["manifest", "--out", out, shots]);
    expect(made.code).toBe(0);
    expect(made.stdout).toContain("OK: 6 frames");
    const written: Manifest = JSON.parse(readFileSync(out, "utf8"));
    const reviewPath = factory_file(
      join(work, "review.json"),
      JSON.stringify({ frames: Object.fromEntries(written.frames.map((frame) => [frame.id, { clean: NOTES }])) }),
    );
    expect((await factory_cli("review-frames.ts", ["check", out, reviewPath])).stdout).toBe(
      "OK: 6 frames, 0 findings\n",
    );
    expect((await factory_cli("review-frames.ts", ["check", out, reviewPath, "--triaged"])).stdout).toBe(
      "OK: 6 frames, 0 findings, 0 untriaged\n",
    );
    factory_file(reviewPath, JSON.stringify({ frames: {} }));
    const failing = await factory_cli("review-frames.ts", ["check", out, reviewPath]);
    expect(failing.code).toBe(1);
    expect(failing.stdout).toContain("ERR: F1: not reviewed");

    writeState(shots, "panel", "after", "panel-after-390-light-01of01.png");
    factory_file(join(shots, "stray.png"), "png");
    const gap = await factory_cli("review-frames.ts", ["manifest", "--out", out, shots]);
    expect(gap.code).toBe(1);
    expect(gap.stdout).toContain(`ERR: missing frame: ${shots}: panel 390 light`);
    expect(gap.stdout).toContain("WARN: left out");
    const empty = factory_testDirectory("frames-empty");
    expect((await factory_cli("review-frames.ts", ["manifest", "--out", out, empty])).code).toBe(1);

    factory_file(out, "{}");
    expect((await factory_cli("review-frames.ts", ["check", out, reviewPath])).code).toBe(1);
    expect((await factory_cli("review-frames.ts", ["manifest", shots])).code).toBe(2);
    expect((await factory_cli("review-frames.ts", ["check", out])).code).toBe(2);
    expect((await factory_cli("review-frames.ts", ["--bad"])).code).toBe(2);
    expect((await factory_cli("review-frames.ts", ["--help"])).code).toBe(0);
  });
});
