import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFrameName, QA_THEMES, QA_VIEWPORTS, stopLabel } from "./matrix";

/** The whole-frame checklist items a reviewer must account for before passing a frame with no findings. */
export const CHECKLIST = ["affordance", "alignment", "sizing", "space", "clipping", "wording", "contrast"] as const;
const MIN_NOTE = 15;

export interface ManifestFrame {
  id: string;
  path: string;
  state: string;
  width: number;
  theme: string;
  /**
   * `01of03` for the viewport frame at that scroll stop, top first; `full-static` for the whole page with sticky and
   * fixed elements laid out in place.
   */
  stop: string;
}

export interface Manifest {
  frames: ManifestFrame[];
  /** Matrix cells a captured state lacks, as `<dir>: <state> <width> <theme>`, or the scroll stops a cell lacks. */
  missing: string[];
  /** PNG files whose names do not follow the evidence naming, left out of the review. */
  unnamed: string[];
}

type ViewportStop = { index: number; count: number };

/** Why a cell's viewport stops are incomplete, or null when they run 01 to their count. */
function stopGap(stops: ViewportStop[]): string | null {
  if (stops.length === 0) return "";
  const counts = [...new Set(stops.map((stop) => stop.count))].sort((a, b) => a - b);
  if (counts.length > 1) return `stops disagree on their count (${counts.join(", ")})`;
  const count = counts[0];
  const absent = Array.from({ length: count }, (_, i) => i + 1).filter(
    (index) => !stops.some((stop) => stop.index === index),
  );
  return absent.length ? `stops ${absent.map((index) => stopLabel({ index, count })).join(", ")}` : null;
}

/**
 * Lists the after frames in each directory for a blind review, in a stable order with neutral IDs (each cell's
 * viewport frames top to bottom, then its full-page image), and reports the matrix cells each captured state lacks or
 * whose scroll stops do not run from 01 to their count. Before frames stay out: a before and after pair tells the
 * reviewer what changed.
 */
export function buildManifest(dirs: string[]): Manifest {
  const frames: Omit<ManifestFrame, "id">[] = [];
  const missing: string[] = [];
  const unnamed: string[] = [];
  for (const dir of dirs.map((entry) => resolve(entry))) {
    // Name order puts a cell's stops top to bottom and its full-static image after them.
    const files = readdirSync(dir)
      .filter((file) => file.endsWith(".png"))
      .sort();
    const stopsByCell = new Map<string, ViewportStop[]>();
    const states = new Set<string>();
    for (const file of files) {
      const name = parseFrameName(file);
      if (!name) {
        unnamed.push(join(dir, file));
        continue;
      }
      if (name.phase !== "after") continue;
      states.add(name.state);
      const cell = `${name.state} ${name.width} ${name.theme}`;
      const stops = stopsByCell.get(cell) ?? [];
      stopsByCell.set(cell, stops);
      if (name.stop !== "full-static") stops.push(name.stop);
      frames.push({
        path: join(dir, file),
        state: name.state,
        width: name.width,
        theme: name.theme,
        stop: stopLabel(name.stop),
      });
    }
    for (const state of [...states].sort())
      for (const { width } of QA_VIEWPORTS)
        for (const theme of QA_THEMES) {
          const cell = `${state} ${width} ${theme}`;
          const gap = stopGap(stopsByCell.get(cell) ?? []);
          if (gap !== null) missing.push(`${dir}: ${cell}${gap ? `: ${gap}` : ""}`);
        }
  }
  return { frames: frames.map((frame, i) => ({ id: `F${i + 1}`, ...frame })), missing, unnamed };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, min = 1): boolean => typeof value === "string" && value.trim().length >= min;
const DISPOSITIONS = new Set(["fixed", "ticket", "duplicate", "rejected"]);

export interface CheckResult {
  problems: string[];
  frames: number;
  findings: number;
  untriaged: number;
}

/**
 * Checks a reviewer's file against the manifest: every frame is accounted for, each with findings or with a note per
 * checklist item saying what was checked; with `triaged`, every finding also carries its disposition (fixed with the
 * revision, ticket or duplicate with the ticket number, or rejected with the reason).
 */
export function checkReview(manifest: Manifest, review: unknown, triaged = false): CheckResult {
  const problems: string[] = [];
  let findings = 0;
  let untriaged = 0;
  if (!isRecord(review) || !isRecord(review.frames)) {
    return { problems: ["review: expected an object with a frames map"], frames: 0, findings: 0, untriaged: 0 };
  }
  const entries = review.frames;
  const ids = new Set(manifest.frames.map((frame) => frame.id));
  for (const id of Object.keys(entries)) if (!ids.has(id)) problems.push(`${id}: not in the manifest`);
  for (const { id } of manifest.frames) {
    const entry = entries[id];
    if (!isRecord(entry)) {
      problems.push(`${id}: not reviewed`);
      continue;
    }
    const list = entry.findings;
    const hasFindings = Array.isArray(list) && list.length > 0;
    if (hasFindings === (entry.clean !== undefined)) {
      problems.push(`${id}: give either a non-empty findings list or a clean justification, not both or neither`);
      continue;
    }
    if (!hasFindings) {
      const clean = entry.clean;
      const thin = CHECKLIST.filter((item) => !isRecord(clean) || !text(clean[item], MIN_NOTE));
      if (thin.length > 0)
        problems.push(`${id}: a clean frame needs a note of at least ${MIN_NOTE} characters for ${thin.join(", ")}`);
      continue;
    }
    list.forEach((finding: unknown, i: number) => {
      findings++;
      const at = `${id} finding ${i + 1}`;
      if (!isRecord(finding)) {
        problems.push(`${at}: expected an object`);
        return;
      }
      for (const field of ["where", "problem", "rule"])
        if (!text(finding[field])) problems.push(`${at}: missing ${field}`);
      if (typeof finding.severity !== "string" || !/^P[0-3]$/.test(finding.severity))
        problems.push(`${at}: severity must be P0-P3`);
      if (!triaged) return;
      const disposition = finding.disposition;
      if (typeof disposition !== "string" || !DISPOSITIONS.has(disposition)) {
        untriaged++;
        problems.push(`${at}: disposition must be fixed, ticket, duplicate or rejected`);
      } else if (!text(finding.ref, disposition === "rejected" ? MIN_NOTE : 1)) {
        untriaged++;
        problems.push(
          `${at}: ref must hold ${disposition === "fixed" ? "the fixing revision" : disposition === "rejected" ? `the reason (at least ${MIN_NOTE} characters)` : "the ticket number"}`,
        );
      }
    });
  }
  return { problems, frames: manifest.frames.length, findings, untriaged };
}
