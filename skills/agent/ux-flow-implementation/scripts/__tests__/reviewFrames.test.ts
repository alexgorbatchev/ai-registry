import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { frameName, isStateSlug, parseFrameName, QA_THEMES, QA_VIEWPORTS } from "../lib/matrix";
import { buildManifest, checkReview, CHECKLIST, type Manifest } from "../lib/reviewFrames";
import { factory_cli, factory_file, factory_testDirectory } from "./fixtures";

/** Writes every matrix cell of a state, optionally leaving one out. */
function writeState(dir: string, state: string, phase: "before" | "after", skip?: string): void {
  for (const { width } of QA_VIEWPORTS)
    for (const theme of QA_THEMES) {
      const name = frameName(state, phase, width, theme);
      if (name !== skip) factory_file(join(dir, name), "png");
    }
}

const NOTES = Object.fromEntries(CHECKLIST.map((item) => [item, `checked ${item} across the whole frame`]));

function manifest(count: number): Manifest {
  return {
    frames: Array.from({ length: count }, (_, i) => ({
      id: `F${i + 1}`,
      path: `/s/${i}.png`,
      state: "s",
      width: 320,
      theme: "light",
    })),
    missing: [],
    unnamed: [],
  };
}

describe("frame names", () => {
  test("round-trip and reject other names", () => {
    expect(frameName("comments-panel", "after", 390, "dark")).toBe("comments-panel-after-390-dark.png");
    expect(parseFrameName("comments-panel-after-390-dark.png")).toEqual({
      state: "comments-panel",
      phase: "after",
      width: 390,
      theme: "dark",
    });
    expect(parseFrameName("home-before-1440-light.png")?.phase).toBe("before");
    expect(parseFrameName("annotated.png")).toBeNull();
    expect(isStateSlug("comments-panel")).toBe(true);
    expect(isStateSlug("Comments panel")).toBe(false);
  });
});

describe("buildManifest", () => {
  test("lists after frames only, with neutral IDs, and names missing cells and unnamed files", () => {
    const one = factory_testDirectory("frames-a");
    const two = factory_testDirectory("frames-b");
    writeState(one, "home", "after");
    writeState(one, "home", "before");
    writeState(two, "panel", "after", "panel-after-320-dark.png");
    factory_file(join(two, "notes.png"), "png");
    factory_file(join(two, "readme.txt"), "text");
    const result = buildManifest([one, two]);
    expect(result.frames).toHaveLength(11);
    expect(result.frames[0]).toEqual({
      id: "F1",
      path: join(one, "home-after-1440-dark.png"),
      state: "home",
      width: 1440,
      theme: "dark",
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
    const ticketless = { frames: { F1: { findings: [{ ...finding, disposition: "ticket" }] } } };
    expect(checkReview(manifest(1), ticketless, true).problems).toEqual([
      "F1 finding 1: ref must hold the ticket number",
    ]);
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

    writeState(shots, "panel", "after", "panel-after-390-light.png");
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
