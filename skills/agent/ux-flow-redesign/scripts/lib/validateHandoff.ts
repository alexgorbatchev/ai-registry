import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

export type HandoffKind = "findings" | "verdicts" | "audit" | "critique";

export interface ValidateOptions {
  /** Pattern every feature-roster ID must match, for example ^F\d{3}$. Any non-empty string passes without it. */
  featurePattern?: RegExp;
}

export const SEVERITIES = ["P0", "P1", "P2", "P3"];
export const CATEGORIES = [
  "bug",
  "workflow",
  "information-architecture",
  "feedback-and-state",
  "discoverability",
  "consistency",
  "density-and-layout",
  "accessibility-keyboard",
  "copy",
  "performance",
  "safety",
];

type Data = Record<string, unknown>;

const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
/** A ticket number as the tracker assigns it. */
const ticketId = (value: unknown): boolean => Number.isInteger(value) && (value as number) > 0;
const list = (value: unknown): value is unknown[] => Array.isArray(value);
const record = (value: unknown): Data =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Data) : {};

function checkScreenshots(
  value: unknown,
  at: string,
  need: (ok: unknown, message: string) => void,
  required: boolean,
): void {
  if (!required && value === undefined) return;
  need(
    list(value) && (!required || value.length > 0),
    `${at}: ${required ? "at least one screenshot is required" : "screenshots must be an array"}`,
  );
  for (const shot of list(value) ? value : []) {
    const { path, caption } = record(shot);
    need(
      text(path) && isAbsolute(path) && existsSync(path),
      `${at}: screenshot path must be absolute and exist: ${String(path)}`,
    );
    need(text(caption), `${at}: every screenshot needs a caption saying what its annotations show`);
  }
}

/** Returns every problem found in a handoff file's parsed JSON; an empty list means it is valid. */
export function validateHandoff(kind: HandoffKind, data: unknown, options: ValidateOptions = {}): string[] {
  const errors: string[] = [];
  const need = (ok: unknown, message: string) => {
    if (!ok) errors.push(message);
  };
  const root = record(data);

  if (kind === "findings") {
    const area = root.area;
    need(text(area), "area must be a non-empty string");
    need(list(root.coverage), "coverage must be an array of {flow, exercised, notes}");
    (list(root.coverage) ? root.coverage : []).forEach((entry, index) => {
      const { flow, exercised } = record(entry);
      need(
        text(flow) && typeof exercised === "boolean",
        `coverage[${index}] needs flow (string) and exercised (boolean)`,
      );
    });
    need(list(root.findings) && root.findings.length > 0, "findings must be a non-empty array");
    const ids = new Set<string>();
    (list(root.findings) ? root.findings : []).forEach((entry, index) => {
      const finding = record(entry);
      const at = `findings[${index}] (${String(finding.id ?? "no id")})`;
      need(
        text(finding.id) && finding.id.startsWith(`${String(area)}-`),
        `${at}: id must start with "${String(area)}-"`,
      );
      need(!ids.has(String(finding.id)), `${at}: duplicate id`);
      ids.add(String(finding.id));
      for (const key of ["title", "observed", "impact", "suggestion"])
        need(text(finding[key]), `${at}: ${key} is required`);
      need(SEVERITIES.includes(String(finding.severity)), `${at}: severity must be one of ${SEVERITIES.join(", ")}`);
      need(CATEGORIES.includes(String(finding.category)), `${at}: category must be one of ${CATEGORIES.join(", ")}`);
      need(list(finding.featureIds), `${at}: featureIds must be an array of roster IDs`);
      for (const id of list(finding.featureIds) ? finding.featureIds : []) {
        need(
          text(id) && (!options.featurePattern || options.featurePattern.test(id)),
          `${at}: bad feature id ${String(id)}`,
        );
      }
      need(list(finding.reproSteps) && finding.reproSteps.length > 0, `${at}: reproSteps are required`);
      need(
        list(finding.acceptanceCriteria) && finding.acceptanceCriteria.length > 0,
        `${at}: acceptanceCriteria are required`,
      );
      checkScreenshots(finding.screenshots, at, need, true);
      need(list(finding.codeRefs), `${at}: codeRefs must be an array of path:line strings`);
      need(typeof finding.needsBackend === "boolean", `${at}: needsBackend must be true or false`);
      need(
        ["high", "medium", "low"].includes(String(finding.confidence)),
        `${at}: confidence must be high, medium or low`,
      );
      need(
        finding.existingTicket == null || ticketId(finding.existingTicket),
        `${at}: existingTicket must be null or a ticket number`,
      );
      need(finding.mergeInto == null || text(finding.mergeInto), `${at}: mergeInto must name the surviving finding id`);
    });
  } else if (kind === "verdicts") {
    need(text(root.area), "area must be a non-empty string");
    need(list(root.verdicts) && root.verdicts.length > 0, "verdicts must be a non-empty array");
    (list(root.verdicts) ? root.verdicts : []).forEach((entry, index) => {
      const verdict = record(entry);
      const at = `verdicts[${index}] (${String(verdict.id ?? "no id")})`;
      need(text(verdict.id), `${at}: id of the finding is required`);
      need(
        ["confirmed", "adjusted", "refuted", "duplicate"].includes(String(verdict.verdict)),
        `${at}: verdict must be confirmed, adjusted, refuted or duplicate`,
      );
      need(SEVERITIES.includes(String(verdict.severity)), `${at}: severity (the final one) is required`);
      need(text(verdict.notes), `${at}: notes must give the evidence for the verdict`);
      if (verdict.verdict === "duplicate") {
        need(
          text(verdict.duplicateOf) || ticketId(verdict.existingTicket),
          `${at}: a duplicate needs duplicateOf or existingTicket`,
        );
      }
      checkScreenshots(verdict.updatedScreenshots, at, need, false);
    });
  } else if (kind === "audit") {
    const dimension = root.dimension;
    need(text(dimension), "dimension must be a non-empty string");
    need(list(root.decisions) && root.decisions.length > 0, "decisions must be a non-empty array");
    need(list(root.coverageGaps), "coverageGaps must be an array (empty when none)");
    const ids = new Set<string>();
    (list(root.decisions) ? root.decisions : []).forEach((entry, index) => {
      const decision = record(entry);
      const at = `decisions[${index}] (${String(decision.id ?? "no id")})`;
      need(
        text(decision.id) && new RegExp(`^${String(dimension)}-\\d{2,}$`).test(decision.id),
        `${at}: id must look like ${String(dimension)}-01`,
      );
      need(!ids.has(String(decision.id)), `${at}: duplicate id`);
      ids.add(String(decision.id));
      need(text(decision.topic) && text(decision.question), `${at}: topic and a neutral question are required`);
      need(typeof decision.conflict === "boolean", `${at}: conflict must be true or false`);
      const current = record(decision.currentApp);
      need(
        text(current.behavior) && list(current.evidence) && current.evidence.length > 0,
        `${at}: currentApp needs behavior and path:line evidence`,
      );
      need(
        list(decision.positions) && decision.positions.length > 0,
        `${at}: positions must list every stated position`,
      );
      for (const position of list(decision.positions) ? decision.positions : []) {
        const { flows, position: stated, evidence } = record(position);
        need(
          list(flows) && flows.length > 0 && text(stated) && text(evidence),
          `${at}: each position needs flows, position and evidence`,
        );
      }
      need(list(decision.silentFlows), `${at}: silentFlows must be an array (empty when none)`);
    });
  } else if (kind === "critique") {
    need(text(root.lens), "lens must be a non-empty string");
    need(list(root.issues), "issues must be an array (empty when the lens found nothing)");
    (list(root.issues) ? root.issues : []).forEach((entry, index) => {
      const issue = record(entry);
      const at = `issues[${index}]`;
      need(
        ["blocker", "major", "minor"].includes(String(issue.severity)),
        `${at}: severity must be blocker, major or minor`,
      );
      for (const key of ["section", "problem", "evidence", "fix"]) need(text(issue[key]), `${at}: ${key} is required`);
    });
  } else {
    errors.push(`unknown kind ${String(kind)}; use findings, verdicts, audit or critique`);
  }
  return errors;
}
