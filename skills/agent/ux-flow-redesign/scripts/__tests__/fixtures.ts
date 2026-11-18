import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export { factory_testDirectory, factory_testRoot } from "../../../../../packages/registry-cli/src/__tests__/fixtures";

export const TEMPLATES = join(import.meta.dir, "../../assets/templates");
export const SCRIPTS = join(import.meta.dir, "..");

/** Replaces every template placeholder with plausible content so a template becomes a finished page. */
export function factory_filledTemplate(name: string, key: string): string {
  return readFileSync(join(TEMPLATES, name), "utf8").replace(
    /\{\{\s*([A-Z0-9_]+)\s*\}\}/g,
    (_match, placeholder: string) => {
      if (placeholder === "FLOW_KEY") return key;
      if (placeholder === "TICKET_URL") return "https://tracker.example/issues/101";
      if (placeholder === "TICKET_LABEL") return "#101";
      const step = /^STEP_(\d+)_ID$/.exec(placeholder);
      if (step) return `step-${step[1]}`;
      return placeholder.toLowerCase().replaceAll("_", " ");
    },
  );
}

/** Writes a finished wireframe set for one flow: stylesheet, index, flow page and the files its nav links. */
export function factory_wireframeSet(
  root: string,
  key = "export-reports",
): { flowPage: string; wireframes: string; pages: string[] } {
  const wireframes = join(root, "wireframes");
  mkdirSync(join(root, "proposals"), { recursive: true });
  mkdirSync(wireframes, { recursive: true });
  copyFileSync(join(TEMPLATES, "wireframe.css"), join(wireframes, "wireframe.css"));
  writeFileSync(
    join(wireframes, "index.html"),
    factory_filledTemplate("wireframes-index.html", key).replace(
      "<!-- flow cards",
      `<div class="card"><h3><a href="${key}.html">flow title</a></h3></div>\n<!-- flow cards`,
    ),
  );
  writeFileSync(join(wireframes, "patterns.html"), factory_filledTemplate("patterns.html", key));
  writeFileSync(join(root, "patterns.md"), "# Patterns\n");
  writeFileSync(join(root, `${key}-current.html`), "<!doctype html><title>current</title><h1>Current</h1>");
  writeFileSync(join(root, `${key}-proposed.html`), "<!doctype html><title>proposed</title><h1>Proposed</h1>");
  writeFileSync(join(root, "proposals", `${key}.md`), "# Proposal\n");
  const flowPage = join(wireframes, `${key}.html`);
  writeFileSync(flowPage, factory_filledTemplate("flow-wireframe.html", key));
  return { flowPage, wireframes, pages: [flowPage, join(wireframes, "index.html"), join(wireframes, "patterns.html")] };
}

/** Writes a file, creating its directory. */
export function factory_file(path: string, text: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
}

/** A minimal page that links the shared stylesheet; `body` goes inside <body> after the h1. */
export function factory_page(body: string, head = ""): string {
  return `<!doctype html><html><head><link rel="stylesheet" href="wireframe.css">${head}</head><body><h1>Page</h1>\n${body}\n</body></html>`;
}
