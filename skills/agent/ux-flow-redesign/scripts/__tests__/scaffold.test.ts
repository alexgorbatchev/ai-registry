import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lintWireframes } from "../lib/lintWireframes";
import { scaffold } from "../lib/scaffold";
import { factory_file, factory_testDirectory, SCRIPTS } from "./fixtures";

function gitRepository(): string {
  const root = factory_testDirectory("scaffold-repo");
  const git = (...args: string[]) =>
    Bun.spawnSync(["git", "-C", root, ...args], { stdout: "ignore", stderr: "ignore" });
  git("init", "-q");
  git("remote", "add", "origin", "https://example.com/team/app.git");
  factory_file(join(root, "README.md"), "app\n");
  git("add", ".");
  git("-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-qm", "init");
  return root;
}

test("init and a flow create every file once, link the flow and list what is left to fill", () => {
  const repo = gitRepository();
  const docs = join(repo, "docs/ux-flows");
  const index = factory_file(join(repo, "docs/index.md"), "# Docs\n");
  const first = scaffold({
    docsDir: docs,
    init: true,
    key: "export-reports",
    title: "Export reports",
    product: "Ledger",
    ticketUrl: "https://tracker.example/issues/7",
    ticketLabel: "#7",
    docsIndex: index,
    timestamp: "2026-01-02 03:04",
  });
  expect(first.created.map((path) => path.slice(docs.length + 1)).sort()).toEqual([
    "export-reports-current.json",
    "export-reports-proposed.json",
    "patterns.md",
    "proposals/export-reports.md",
    "wireframes/export-reports.html",
    "wireframes/index.html",
    "wireframes/patterns.html",
    "wireframes/wireframe.css",
  ]);
  const revision = Bun.spawnSync(["git", "-C", repo, "rev-parse", "HEAD"], { stdout: "pipe" }).stdout.toString().trim();
  const current = JSON.parse(readFileSync(join(docs, "export-reports-current.json"), "utf8"));
  expect(current.meta).toMatchObject({
    title: "Export reports today",
    output: "docs/ux-flows/export-reports-current.html",
    repository: { url: "https://example.com/team/app.git", revision },
  });
  expect(readFileSync(join(docs, "proposals/export-reports.md"), "utf8")).toContain("created_on: 2026-01-02 03:04");
  const docsIndex = readFileSync(index, "utf8");
  expect(docsIndex).toContain("| Export reports | [current](ux-flows/export-reports-current.html) |");
  expect(docsIndex).toContain("[#7](https://tracker.example/issues/7)");
  expect(readFileSync(join(docs, "wireframes/index.html"), "utf8")).toContain(
    '<a href="export-reports.html">Export reports</a>',
  );
  expect(first.todo[join(docs, "wireframes/export-reports.html")]).toContain("TLDR_ONE_SENTENCE");
  // Until the content is written and the diagrams are rendered, only placeholders and the diagram links fail.
  const lint = lintWireframes([join(docs, "wireframes/export-reports.html")]);
  expect(new Set(lint.map((finding) => finding.rule))).toEqual(new Set(["placeholder", "link"]));
  expect(lint.filter((finding) => finding.rule === "link").map((finding) => finding.message.split(" ")[0])).toEqual([
    "../export-reports-current.html",
    "../export-reports-proposed.html",
  ]);

  writeFileSync(join(docs, "patterns.md"), "kept\n");
  const second = scaffold({
    docsDir: docs,
    init: true,
    key: "export-reports",
    title: "Export reports",
    docsIndex: index,
  });
  expect(second.created).toEqual([]);
  expect(second.linked).toEqual([]);
  expect(second.kept.length).toBe(8);
  expect(readFileSync(join(docs, "patterns.md"), "utf8")).toBe("kept\n");
  expect(readFileSync(index, "utf8").match(/\| Export reports \|/g)?.length).toBe(1);
});

test("rejects bad input and leaves identifiers it cannot find as placeholders", () => {
  const docs = join(factory_testDirectory("scaffold-plain"), "ux-flows");
  expect(() => scaffold({ docsDir: docs })).toThrow("pass --init, --key, or both");
  expect(() => scaffold({ docsDir: docs, key: "Bad Key", title: "x" })).toThrow("kebab-case");
  expect(() => scaffold({ docsDir: docs, key: "ok" })).toThrow("--key needs --title");
  const result = scaffold({ docsDir: docs, key: "import-files", title: "Import files", repoRoot: docs });
  expect(result.todo[join(docs, "import-files-current.json")]).toEqual(
    expect.arrayContaining(["REVISION", "REPOSITORY_URL"]),
  );
  expect(result.linked).toEqual([]);
});

test("the CLI prints created, todo and errors", () => {
  const docs = join(factory_testDirectory("scaffold-cli"), "ux-flows");
  const run = Bun.spawnSync(["bun", join(SCRIPTS, "scaffold-flow.ts"), "--docs", docs, "--init"], { stdout: "pipe" });
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toContain(`created ${join(docs, "wireframes/wireframe.css")}`);
  expect(run.stdout.toString()).toContain("todo ");
  const bad = Bun.spawnSync(["bun", join(SCRIPTS, "scaffold-flow.ts"), "--docs", docs, "--key", "x y"], {
    stderr: "pipe",
  });
  expect(bad.exitCode).toBe(2);
  expect(bad.stderr.toString()).toContain("kebab-case");
  expect(Bun.spawnSync(["bun", join(SCRIPTS, "scaffold-flow.ts")], { stdout: "pipe" }).exitCode).toBe(2);
});

test("without a ticket the nav says so, and a Markdown ticket path is rebased for every file that links it", () => {
  const repo = gitRepository();
  const docs = join(repo, "docs/ux-flows");
  const index = factory_file(join(repo, "docs/index.md"), "# Docs\n");
  scaffold({ docsDir: docs, init: true, product: "Ledger", docsIndex: index });
  scaffold({ docsDir: docs, key: "import-files", title: "Import files", docsIndex: index });
  const unfiled = readFileSync(join(docs, "wireframes/import-files.html"), "utf8");
  expect(unfiled).toContain('<span class="muted">Redesign ticket: not filed yet</span>');
  expect(unfiled).toContain("<title>Import files · proposed flow wireframe</title>");
  expect(unfiled).toContain("<b>Ledger › ");
  expect(readFileSync(join(docs, "proposals/import-files.md"), "utf8")).toContain("Redesign ticket: not filed yet.");
  expect(readFileSync(index, "utf8")).toContain("| not filed yet |");
  const rules = lintWireframes([join(docs, "wireframes/import-files.html")]).map((finding) => finding.rule);
  expect(rules).toContain("nav-ticket");
  expect(rules.filter((rule) => rule === "placeholder").length).toBeGreaterThan(0);

  const filed = scaffold({
    docsDir: docs,
    key: "export-reports",
    title: "Export reports",
    ticketUrl: "tickets/redesign-export-reports.md",
    ticketLabel: "redesign-export-reports",
    docsIndex: index,
  });
  expect(filed.todo[join(docs, "wireframes/export-reports.html")]).not.toContain("PRODUCT");
  expect(readFileSync(join(docs, "wireframes/export-reports.html"), "utf8")).toContain(
    '<a href="../tickets/redesign-export-reports.md">Redesign ticket redesign-export-reports</a>',
  );
  expect(readFileSync(join(docs, "wireframes/index.html"), "utf8")).toContain(
    '<a href="../tickets/redesign-export-reports.md">redesign-export-reports</a>',
  );
  expect(readFileSync(index, "utf8")).toContain(
    "[redesign-export-reports](ux-flows/tickets/redesign-export-reports.md)",
  );
  factory_file(join(docs, "tickets/redesign-export-reports.md"), "# redesign-export-reports\n");
  const linked = lintWireframes([join(docs, "wireframes/export-reports.html")]);
  expect(linked.map((finding) => finding.rule)).not.toContain("nav-ticket");
});

test("refuses to write into the skill itself", () => {
  expect(() => scaffold({ docsDir: join(SCRIPTS, "../docs/ux-flows"), init: true })).toThrow("inside this skill");
});

test("names the repository by its origin or main checkout and refreshes edited front matter", () => {
  const repo = gitRepository();
  const index = factory_file(
    join(repo, "docs/index.md"),
    "---\ncreated_on: 2026-01-01 00:00\nlast_modified: 2026-01-01 00:00\nstatus: current\n---\n\n# Docs\n",
  );
  scaffold({
    docsDir: join(repo, "docs/ux-flows"),
    init: true,
    product: "Ledger",
    docsIndex: index,
    timestamp: "2026-02-03 04:05",
  });
  expect(readFileSync(index, "utf8")).toContain("last_modified: 2026-02-03 04:05");
  expect(readFileSync(index, "utf8")).toContain("created_on: 2026-01-01 00:00");
  scaffold({
    docsDir: join(repo, "docs/ux-flows"),
    key: "a-flow",
    title: "A flow",
    docsIndex: index,
    timestamp: "2026-02-03 05:06",
  });
  expect(readFileSync(index, "utf8")).toContain("last_modified: 2026-02-03 05:06");
  expect(readFileSync(join(repo, "docs/ux-flows/proposals/a-flow.md"), "utf8")).toContain(
    "Source revision: team/app `",
  );

  const local = factory_testDirectory("scaffold-local");
  const main = join(local, "main-checkout");
  factory_file(join(main, "README.md"), "x\n");
  const git = (...args: string[]) =>
    Bun.spawnSync(["git", "-C", main, ...args], { stdout: "ignore", stderr: "ignore" });
  git("init", "-q");
  git("add", ".");
  git("-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-qm", "init");
  git("worktree", "add", "-q", join(local, "run-1"), "HEAD");
  const docs = join(local, "run-1/docs/ux-flows");
  scaffold({ docsDir: docs, key: "b-flow", title: "B flow", product: "Ledger" });
  expect(readFileSync(join(docs, "proposals/b-flow.md"), "utf8")).toContain("Source revision: main-checkout `");
});
