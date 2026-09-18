#!/usr/bin/env bun
/**
 * Validates SKILL.md structure, frontmatter, and internal links.
 *
 * Usage:
 *   bun scripts/quick-validate.ts <skill-dir-or-SKILL.md> [...more]
 *
 * Exit code 0 when every target passes (warnings allowed), 1 when any error is found.
 */

import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

const REQUIRED_KEYS = ["name", "description", "author"] as const;
const OPTIONAL_KEYS = ["metadata", "license", "allowed-tools", "disable-model-invocation"] as const;
const ALLOWED_KEYS = new Set<string>([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_STATUS = new Set(["current", "archived"]);
const DESCRIPTION_MAX = 1024;
const BODY_MAX_LINES = 500;

type Finding = { level: "ERROR" | "WARN"; message: string };

/**
 * Vendored skills are upstream copies that `bun run skills:update` overwrites, so repo
 * conventions (`author`, `metadata`) are reported against them as warnings, not errors.
 */
async function vendoredSkillNames(skillDir: string): Promise<Set<string>> {
  let dir = skillDir;
  while (true) {
    const lockPath = join(dir, "skills-lock.json");
    if (await exists(lockPath)) {
      try {
        const lock = (await Bun.file(lockPath).json()) as { skills?: Record<string, unknown> };
        return new Set(Object.keys(lock.skills ?? {}));
      } catch {
        return new Set();
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return new Set();
    dir = parent;
  }
}

function splitFrontmatter(source: string): { frontmatter: string; body: string } | null {
  if (!source.startsWith("---\n")) return null;
  const end = source.indexOf("\n---", 3);
  if (end === -1) return null;
  const newlineAfterFence = source.indexOf("\n", end + 1);
  return {
    frontmatter: source.slice(4, end + 1),
    body: newlineAfterFence === -1 ? "" : source.slice(newlineAfterFence + 1),
  };
}

/** Markdown links outside fenced code blocks, so illustrative examples inside fences are ignored. */
function linkedRelativePaths(body: string): string[] {
  const paths: string[] = [];
  let fenced = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const match of line.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = match[1]!;
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#") || target.startsWith("/")) continue;
      paths.push(target.split("#")[0]!);
    }
  }
  return paths;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function validateSkill(skillFile: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const skillDir = dirname(skillFile);
  const source = await Bun.file(skillFile).text();

  const parts = splitFrontmatter(source);
  if (!parts) {
    return [{ level: "ERROR", message: "Missing YAML frontmatter delimited by `---` at the top of the file." }];
  }

  let frontmatter: unknown;
  try {
    frontmatter = Bun.YAML.parse(parts.frontmatter);
  } catch (error) {
    return [{ level: "ERROR", message: `Frontmatter is not valid YAML: ${(error as Error).message}` }];
  }
  if (typeof frontmatter !== "object" || frontmatter === null || Array.isArray(frontmatter)) {
    return [{ level: "ERROR", message: "Frontmatter must be a YAML mapping." }];
  }
  const fm = frontmatter as Record<string, unknown>;
  const vendored = (await vendoredSkillNames(skillDir)).has(basename(skillDir));
  const convention: Finding["level"] = vendored ? "WARN" : "ERROR";
  const upstream = vendored ? " (vendored skill, owned upstream)" : "";

  for (const key of REQUIRED_KEYS) {
    if (!(key in fm)) {
      findings.push({
        level: key === "author" ? convention : "ERROR",
        message: `Frontmatter is missing required key \`${key}\`.${key === "author" ? upstream : ""}`,
      });
    }
  }
  for (const key of Object.keys(fm)) {
    if (!ALLOWED_KEYS.has(key)) {
      findings.push({ level: "ERROR", message: `Frontmatter key \`${key}\` is not allowed. Historical attributes belong under \`metadata\`.` });
    }
  }

  const name = fm.name;
  if (typeof name !== "string") {
    if ("name" in fm) findings.push({ level: "ERROR", message: "`name` must be a string." });
  } else {
    if (!SKILL_NAME.test(name)) findings.push({ level: "ERROR", message: `\`name\` must be lowercase kebab-case, got \`${name}\`.` });
    if (name !== basename(skillDir)) {
      findings.push({ level: "ERROR", message: `\`name\` (\`${name}\`) must match the skill directory name (\`${basename(skillDir)}\`).` });
    }
  }

  const description = fm.description;
  if (typeof description !== "string") {
    if ("description" in fm) findings.push({ level: "ERROR", message: "`description` must be a string." });
  } else {
    if (description.length > DESCRIPTION_MAX) {
      findings.push({ level: "ERROR", message: `\`description\` is ${description.length} characters, over the ${DESCRIPTION_MAX} maximum.` });
    }
    if (/[<>]/.test(description)) findings.push({ level: "ERROR", message: "`description` must not contain `<` or `>`." });
    if (description.trim().length === 0) findings.push({ level: "ERROR", message: "`description` must not be empty." });
  }

  if ("author" in fm && typeof fm.author !== "string") {
    findings.push({ level: "ERROR", message: "`author` must be a string." });
  }

  const metadata = fm.metadata;
  if (metadata === undefined) {
    findings.push({ level: convention, message: `Frontmatter is missing the \`metadata\` block with \`created_on\`, \`last_modified\`, and \`status\`.${upstream}` });
  } else if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    findings.push({ level: "ERROR", message: "`metadata` must be a mapping." });
  } else {
    const meta = metadata as Record<string, unknown>;
    for (const key of ["created_on", "last_modified"]) {
      const value = meta[key];
      if (value === undefined) {
        findings.push({ level: "ERROR", message: `\`metadata.${key}\` is required.` });
      } else if (typeof value !== "string" || !TIMESTAMP.test(value)) {
        findings.push({ level: "ERROR", message: `\`metadata.${key}\` must match \`YYYY-MM-DD HH:MM\`, got \`${String(value)}\`.` });
      }
    }
    if (typeof meta.created_on === "string" && typeof meta.last_modified === "string" && meta.last_modified < meta.created_on) {
      findings.push({ level: "ERROR", message: "`metadata.last_modified` is earlier than `metadata.created_on`." });
    }
    if (meta.status === undefined) {
      findings.push({ level: "ERROR", message: "`metadata.status` is required." });
    } else if (typeof meta.status !== "string" || !ALLOWED_STATUS.has(meta.status)) {
      findings.push({ level: "ERROR", message: `\`metadata.status\` must be \`current\` or \`archived\`, got \`${String(meta.status)}\`.` });
    }
  }

  if (parts.body.trim().length === 0) {
    findings.push({ level: "ERROR", message: "Body is empty. A skill must carry instructions, not frontmatter alone." });
  }
  const bodyLines = parts.body.split("\n").length;
  if (bodyLines > BODY_MAX_LINES) {
    findings.push({ level: "WARN", message: `Body is ${bodyLines} lines, over the ${BODY_MAX_LINES}-line guideline. Move detail into \`references/\`.` });
  }

  for (const relative of linkedRelativePaths(parts.body)) {
    if (!(await exists(join(skillDir, relative)))) {
      findings.push({ level: "ERROR", message: `Linked file \`${relative}\` does not exist in the skill folder.` });
    }
  }

  for (const entry of await readdir(skillDir)) {
    if (/^(README|CHANGELOG|INSTALL|INSTALLATION_GUIDE|QUICK_REFERENCE)\.md$/i.test(entry)) {
      findings.push({ level: "WARN", message: `\`${entry}\` is auxiliary documentation and does not belong in a skill folder.` });
    }
  }

  return findings;
}

async function resolveSkillFile(target: string): Promise<string | null> {
  const path = resolve(target);
  const info = await stat(path).catch(() => null);
  if (!info) return null;
  if (info.isDirectory()) {
    const candidate = join(path, "SKILL.md");
    return (await exists(candidate)) ? candidate : null;
  }
  return basename(path) === "SKILL.md" ? path : null;
}

const targets = Bun.argv.slice(2);
if (targets.length === 0) {
  console.error("Usage: bun scripts/quick-validate.ts <skill-dir-or-SKILL.md> [...more]");
  process.exit(2);
}

let failed = false;
for (const target of targets) {
  const skillFile = await resolveSkillFile(target);
  if (!skillFile) {
    console.error(`[ERROR] ${target}: no SKILL.md found at this path.`);
    failed = true;
    continue;
  }
  const findings = await validateSkill(skillFile);
  const errors = findings.filter((finding) => finding.level === "ERROR");
  if (findings.length === 0) {
    console.log(`[OK] ${skillFile}`);
    continue;
  }
  console.log(`${errors.length > 0 ? "[ERROR]" : "[WARN]"} ${skillFile}`);
  for (const finding of findings) console.log(`  [${finding.level}] ${finding.message}`);
  if (errors.length > 0) failed = true;
}

process.exit(failed ? 1 : 0);
