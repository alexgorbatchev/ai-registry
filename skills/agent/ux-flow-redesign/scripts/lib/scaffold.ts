import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

export interface ScaffoldOptions {
  /** The ux-flows directory inside the served documentation tree. */
  docsDir: string;
  /** Create the shared files (stylesheet, wireframe index, visual and written pattern reference) when missing. */
  init?: boolean;
  /** Kebab-case flow key; every file of the flow is named after it. */
  key?: string;
  title?: string;
  product?: string;
  /** The filed redesign ticket's http(s) URL; without it the links read "not filed yet". */
  ticketUrl?: string;
  ticketLabel?: string;
  /** Repository root for diagram evidence; defaults to the Git top level of docsDir. */
  repoRoot?: string;
  /** Documentation index (Markdown) holding the "ux-flows rows" marker; gains one row per new flow. */
  docsIndex?: string;
  /** Overrides the timestamp written into front matter, as YYYY-MM-DD HH:MM. */
  timestamp?: string;
  templatesDir?: string;
}

export interface ScaffoldResult {
  created: string[];
  kept: string[];
  linked: string[];
  /** Placeholders still to fill, by file, for every file this run created or linked into. */
  todo: Record<string, string[]>;
}

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PLACEHOLDER = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;
const CARD_MARKER = "<!-- flow cards: scaffold-flow.ts inserts new cards above this line -->";
const ROW_MARKER = "<!-- ux-flows rows: scaffold-flow.ts inserts new rows above this line -->";
const NAV_TICKET = '<a href="{{TICKET_URL}}">Redesign ticket {{TICKET_LABEL}}</a>';

function localTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function git(root: string, ...args: string[]): string | undefined {
  const result = Bun.spawnSync(["git", "-C", root, ...args], { stdout: "pipe", stderr: "ignore" });
  return result.exitCode === 0 ? result.stdout.toString().trim() : undefined;
}

/** Names the repository by its origin path (team/app), else by the main checkout's directory, so a worktree's own
 * directory name never stands in for the repository. */
function repositoryName(root: string, remote: string | undefined): string {
  const path = remote
    ?.replace(/\.git$/, "")
    .replace(/^[\w.-]+@[\w.-]+:/, "")
    .replace(/^[a-z+]+:\/\/[^/]+\//i, "");
  if (path && !path.includes("://")) return path;
  const common = git(root, "rev-parse", "--path-format=absolute", "--git-common-dir");
  return basename(common ? dirname(common) : root);
}

/** Sets an existing front matter's last_modified to the given timestamp. */
function touchFrontMatter(text: string, timestamp: string): string {
  return text.replace(/^(---\r?\n[\s\S]*?^last_modified: ).*$/m, `$1${timestamp}`);
}

/** Accepts only addresses a diagram may publish: HTTP(S) without credentials, or SSH. */
function publishableRemote(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//.test(url)) return new URL(url).username || new URL(url).password ? undefined : url;
  if (url.startsWith("ssh://") || /^[\w.-]+@[\w.-]+:[\w./-]+$/.test(url)) return url;
  return undefined;
}

function fill(template: string, values: Record<string, string | undefined>): string {
  return template.replace(PLACEHOLDER, (match, name: string) => values[name] ?? match);
}

function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]))].sort();
}

/** Creates the shared design-language files and one flow's file set from the bundled templates, never overwriting. */
export function scaffold(options: ScaffoldOptions): ScaffoldResult {
  const templates = options.templatesDir ?? join(import.meta.dir, "../../assets/templates");
  const docsDir = resolve(options.docsDir);
  const result: ScaffoldResult = { created: [], kept: [], linked: [], todo: {} };
  if (!options.init && !options.key) throw new Error("pass --init, --key, or both");
  if (options.key && !KEY_PATTERN.test(options.key)) throw new Error(`flow key "${options.key}" must be kebab-case`);
  if (options.key && !options.title) throw new Error("--key needs --title");
  if (options.ticketUrl && !/^https?:\/\//.test(options.ticketUrl))
    throw new Error("--ticket-url must be the ticket's http(s) URL");

  const skillRoot = resolve(import.meta.dir, "../..");
  if (docsDir === skillRoot || docsDir.startsWith(`${skillRoot}/`)) {
    throw new Error("--docs points inside this skill; run from the project root and pass a project path");
  }

  // The docs directory may not exist yet; ask Git from its nearest existing ancestor.
  let probe = docsDir;
  while (!existsSync(probe) && dirname(probe) !== probe) probe = dirname(probe);
  const repoRoot = resolve(options.repoRoot ?? git(probe, "rev-parse", "--show-toplevel") ?? process.cwd());
  const patternsPath = join(docsDir, "patterns.md");
  const savedProduct = existsSync(patternsPath)
    ? /^# (.+) shared UX pattern reference$/m.exec(readFileSync(patternsPath, "utf8"))?.[1]
    : undefined;
  const values: Record<string, string | undefined> = {
    FLOW_KEY: options.key,
    FLOW_TITLE: options.title,
    PRODUCT: options.product ?? savedProduct,
    TICKET_LABEL: options.ticketLabel ?? (options.ticketUrl ? "ticket" : "not filed yet"),
    TIMESTAMP: options.timestamp ?? localTimestamp(),
    DOCS_DIR: relative(repoRoot, docsDir).split("\\").join("/") || ".",
    REVISION: git(repoRoot, "rev-parse", "HEAD"),
    SHORT_REVISION: git(repoRoot, "rev-parse", "--short", "HEAD"),
    REPOSITORY_URL: publishableRemote(git(repoRoot, "remote", "get-url", "origin")),
    REPOSITORY: repositoryName(repoRoot, publishableRemote(git(repoRoot, "remote", "get-url", "origin"))),
  };

  const write = (target: string, template: string) => {
    const path = join(docsDir, target);
    if (existsSync(path)) {
      result.kept.push(path);
      return;
    }
    mkdirSync(dirname(path), { recursive: true });
    let source = readFileSync(join(templates, template), "utf8");
    if (!options.ticketUrl)
      source = source.replace(NAV_TICKET, '<span class="muted">Redesign ticket: not filed yet</span>');
    const text = fill(source, { ...values, TICKET_URL: options.ticketUrl });
    writeFileSync(path, text);
    result.created.push(path);
    const remaining = placeholders(text);
    if (remaining.length) result.todo[path] = remaining;
  };

  const insertBefore = (path: string, marker: string, alreadyLinked: string, text: string) => {
    if (!existsSync(path)) return;
    const current = readFileSync(path, "utf8");
    if (current.includes(alreadyLinked)) return;
    if (!current.includes(marker)) throw new Error(`${path} has no "${marker}" marker`);
    const inserted = current.replace(marker, `${text}\n${marker}`);
    const updated = path.endsWith(".md") ? touchFrontMatter(inserted, values.TIMESTAMP ?? localTimestamp()) : inserted;
    writeFileSync(path, updated);
    result.linked.push(path);
    const remaining = placeholders(updated);
    if (remaining.length) result.todo[path] = remaining;
  };

  if (options.init) {
    write("wireframes/wireframe.css", "wireframe.css");
    write("wireframes/index.html", "wireframes-index.html");
    write("wireframes/patterns.html", "patterns.html");
    write("patterns.md", "patterns.md");
    if (options.docsIndex) {
      const index = resolve(options.docsIndex);
      const current = existsSync(index) ? readFileSync(index, "utf8") : "";
      if (!current.includes(ROW_MARKER)) {
        const base = relative(dirname(index), docsDir).split("\\").join("/") || ".";
        const section = fill(readFileSync(join(templates, "docs-index-section.md"), "utf8"), values).replaceAll(
          "ux-flows/",
          `${base}/`,
        );
        mkdirSync(dirname(index), { recursive: true });
        const separator = current === "" || current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n";
        writeFileSync(
          index,
          touchFrontMatter(`${current}${separator}${section}`, values.TIMESTAMP ?? localTimestamp()),
        );
        result.linked.push(index);
        const remaining = placeholders(readFileSync(index, "utf8"));
        if (remaining.length) result.todo[index] = remaining;
      }
    }
  }

  if (options.key) {
    const key = options.key;
    write(`wireframes/${key}.html`, "flow-wireframe.html");
    write(`proposals/${key}.md`, "proposal.md");
    write(`${key}-current.json`, "current-flow.workflow.json");
    write(`${key}-proposed.json`, "proposed-flow.workflow.json");
    const ticket = options.ticketUrl ? `<a href="${options.ticketUrl}">${values.TICKET_LABEL}</a>` : "";
    insertBefore(
      join(docsDir, "wireframes/index.html"),
      CARD_MARKER,
      `href="${key}.html"`,
      `<div class="card"><h3><a href="${key}.html">${options.title}</a></h3><p>{{TLDR_ONE_SENTENCE}}</p><div class="links"><a href="../${key}-proposed.html">Diagram</a><a href="../proposals/${key}.md">Proposal</a>${ticket}</div></div>`,
    );
    if (options.docsIndex) {
      const index = resolve(options.docsIndex);
      const base = relative(dirname(index), docsDir).split("\\").join("/") || ".";
      const redesign = options.ticketUrl ? `[${values.TICKET_LABEL}](${options.ticketUrl})` : "not filed yet";
      insertBefore(
        index,
        ROW_MARKER,
        `${base}/wireframes/${key}.html`,
        `| ${options.title} | [current](${base}/${key}-current.html) | [proposed](${base}/${key}-proposed.html) | [wireframe](${base}/wireframes/${key}.html) | [proposal](${base}/proposals/${key}.md) | ${redesign} |`,
      );
    }
  }
  return result;
}
