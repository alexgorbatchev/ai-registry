import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { readCssRules, rootTokens, type CssRule } from "./css";
import {
  childElements,
  closest,
  descendants,
  findAll,
  hasClass,
  parseHtml,
  textContent,
  type HtmlElement,
  type HtmlNode,
} from "./html";

export type Severity = "error" | "warning";

export interface Finding {
  file: string;
  line: number;
  severity: Severity;
  rule: string;
  message: string;
}

export interface LintOptions {
  /** File name of the shared stylesheet every page links; defaults to wireframe.css. */
  stylesheet?: string;
  /** Directory that root-relative links (`/…`) resolve against; root links are skipped without it. */
  siteRoot?: string;
}

interface Page {
  path: string;
  source: string;
  root: HtmlElement;
}

const COPIED_BLOCK_MARKER = /\/\*\s*wireframe-css\b/;
const CSS_WIDE_KEYWORDS = new Set(["inherit", "initial", "unset", "revert", "revert-layer"]);
const FONT_TOKEN = "var(--font)";

/** Conventions every mockup may use; each needs a legend entry whose text matches `legend`. */
const CONVENTIONS: { name: string; used: (element: HtmlElement) => boolean; legend: RegExp }[] = [
  { name: "toast", used: (element) => hasClass(element, "toast"), legend: /toast/i },
  {
    name: "popover or menu",
    used: (element) => hasClass(element, "popover") || hasClass(element, "menu"),
    legend: /popover|menu/i,
  },
  { name: "docked panel", used: (element) => hasClass(element, "dock"), legend: /panel|dock/i },
  { name: "dimmed backdrop", used: (element) => hasClass(element, "scrim"), legend: /backdrop|dialog/i },
  { name: "selected rows", used: (element) => hasClass(element, "sel"), legend: /selected/i },
  {
    name: "just-changed tint",
    used: (element) => hasClass(element, "flash") || hasClass(element, "chg"),
    legend: /changed/i,
  },
  { name: "row cursor", used: (element) => element.tag === "tr" && hasClass(element, "focus"), legend: /cursor/i },
];

/** Flags font families other than the token, and a capped page width (max-width on main). */
function checkCss(rules: CssRule[], file: string, findings: Finding[]): void {
  for (const rule of rules) {
    for (const declaration of rule.declarations) {
      const property = declaration.property;
      if (property !== "font" && property !== "font-family") continue;
      const value = declaration.value.replace(/!important\s*$/i, "").trim();
      if (CSS_WIDE_KEYWORDS.has(value.toLowerCase())) continue;
      const valid = property === "font-family" ? value === FONT_TOKEN : value.endsWith(FONT_TOKEN);
      if (valid) continue;
      findings.push({
        file,
        line: declaration.line,
        severity: "error",
        rule: "font-family",
        message: `${property}: ${value} must use the ${FONT_TOKEN} token as its family`,
      });
    }
    const targetsMain = rule.selector.split(",").some((part) => part.trim() === "main");
    const cap = rule.declarations.find((declaration) => declaration.property === "max-width");
    if (targetsMain && cap && cap.value !== "none") {
      findings.push({
        file,
        line: cap.line,
        severity: "error",
        rule: "layout-cap",
        message: `main has max-width: ${cap.value}; pages use the full window width so wide screens show no empty gap`,
      });
    }
  }
}

function pageCss(page: Page): { rules: CssRule[]; styles: HtmlElement[] } {
  const styles = findAll(page.root, (element) => element.tag === "style");
  const rules: CssRule[] = [];
  for (const style of styles) rules.push(...readCssRules(textContent(style), style.children[0]?.line ?? style.line));
  for (const element of findAll(page.root, (candidate) => candidate.attrs.has("style"))) {
    rules.push(...readCssRules(`{${element.attrs.get("style") ?? ""}}`, element.line));
  }
  return { rules, styles };
}

function isMockupElement(element: HtmlElement): boolean {
  return (
    closest(element, (candidate) => hasClass(candidate, "step")) !== null &&
    closest(element, (candidate) => hasClass(candidate, "cap")) === null
  );
}

function calloutNumbers(container: HtmlElement): HtmlElement[] {
  return findAll(container, (element) => hasClass(element, "n"));
}

function checkSteps(page: Page, findings: Finding[]): void {
  const add = (line: number, rule: string, message: string) =>
    findings.push({ file: page.path, line, severity: "error", rule, message });
  for (const step of findAll(page.root, (element) => hasClass(element, "step"))) {
    const children = childElements(step);
    const caption = children.find((child) => hasClass(child, "cap"));
    const mockups = children.filter((child) => !hasClass(child, "cap"));
    if (!caption || !findAll(caption, (element) => element.tag === "h2").length || !mockups.length) {
      add(step.line, "step", "a step pairs one mockup with a .cap caption that starts with an h2");
      continue;
    }
    const shown = new Map<string, HtmlElement>();
    for (const mockup of mockups) {
      for (const callout of calloutNumbers(mockup)) {
        const number = textContent(callout).trim();
        if (!shown.has(number)) shown.set(number, callout);
      }
    }
    const explained = new Map<string, HtmlElement>();
    for (const callout of calloutNumbers(caption)) {
      const number = textContent(callout).trim();
      if (explained.has(number)) add(callout.line, "callout", `callout ${number} is explained twice in this caption`);
      else explained.set(number, callout);
    }
    for (const [number, callout] of shown) {
      if (!explained.has(number))
        add(callout.line, "callout", `callout ${number} in the mockup is not explained in its caption`);
    }
    for (const [number, callout] of explained) {
      if (!shown.has(number))
        add(callout.line, "callout", `caption explains callout ${number}, which the mockup does not show`);
    }
  }
}

function checkLegend(page: Page, findings: Finding[]): void {
  const keys = findAll(page.root, (element) => hasClass(element, "key"));
  const legends = findAll(page.root, (element) => hasClass(element, "legend"));
  const inKey = legends.filter((legend) => closest(legend, (element) => hasClass(element, "key")) !== null);
  if (!keys.length || !inKey.length) {
    findings.push({
      file: page.path,
      line: legends[0]?.line ?? keys[0]?.line ?? 1,
      severity: "error",
      rule: "legend",
      message: 'mockup pages need the "How to read" .legend inside the sticky .key band',
    });
  }
  for (const legend of legends.filter((candidate) => !inKey.includes(candidate))) {
    findings.push({
      file: page.path,
      line: legend.line,
      severity: "error",
      rule: "legend",
      message: "a .legend outside the sticky .key band scrolls away; move it into .key",
    });
  }
  const legendText = inKey.map(textContent).join(" ");
  const legendHasCallout = inKey.some((legend) => calloutNumbers(legend).length > 0);
  const mockupElements = [...descendants(page.root)].filter(isMockupElement);
  for (const convention of CONVENTIONS) {
    const first = mockupElements.find(convention.used);
    if (first && !convention.legend.test(legendText)) {
      findings.push({
        file: page.path,
        line: first.line,
        severity: "error",
        rule: "legend-entry",
        message: `the mockups use the ${convention.name} convention but the legend does not explain it`,
      });
    }
  }
  const firstCallout = mockupElements.find((element) => hasClass(element, "n"));
  if (firstCallout && !legendHasCallout) {
    findings.push({
      file: page.path,
      line: firstCallout.line,
      severity: "error",
      rule: "legend-entry",
      message: "the mockups use numbered callouts but the legend does not explain them",
    });
  }
}

/** How a row inside a menu reads: a group boundary, an explicit heading, a label-like row, or a command. */
type MenuEntryKind = "separator" | "heading" | "label" | "item";

interface MenuEntry {
  kind: MenuEntryKind;
  element: HtmlElement;
  /** The row opens a group: the menu's first row, the first row after a separator, or the first row of a wrapper. */
  groupStart: boolean;
}

const MENU_CLASSES = new Set([
  "menu",
  "dropdown",
  "dropdown-menu",
  "context-menu",
  "contextmenu",
  "submenu",
  "menu-list",
]);
const POPOVER_CLASSES = new Set(["popover", "popup"]);
/** Block elements; with links and buttons placed directly in a menu they draw rows, while inline content shares one. */
const BLOCK_TAGS = new Set([
  "div",
  "li",
  "ul",
  "ol",
  "menu",
  "p",
  "section",
  "header",
  "footer",
  "nav",
  "dl",
  "dt",
  "dd",
  "hr",
  "form",
  "fieldset",
  "legend",
  "table",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);
const SEPARATOR_CLASS = /^(sep|separator|divider|rule)$/;
const HEADING_CLASS =
  /^(lbl|label|heading|header|hdr|title|subheader|subheading|category)$|-(lbl|label|heading|header|title)$/;
const MUTED_CLASS = /^(muted|mute|dim|dimmed|subtle|secondary|hint|faint|quiet|caption|meta|overline|eyebrow)$/;
const MUTED_STYLE = /var\(--mute\)|text-transform\s*:\s*uppercase|opacity\s*:/i;
const EMPHASIS_TAGS = new Set(["b", "strong", "em", "small"]);
const CONTROL_TAGS = new Set(["a", "button", "input", "select", "textarea"]);
const ITEM_ROLES = new Set(["menuitem", "menuitemcheckbox", "menuitemradio", "option"]);
const CHOICE_GLYPH = /^[☑☐☒◉○●◯⦿✓✔]/;

const classList = (element: HtmlElement) => (element.attrs.get("class") ?? "").split(/\s+/).filter(Boolean);
const isCallout = (element: HtmlElement) => hasClass(element, "n");

/** Text a reader sees in a row, without numbered callout markers. */
function rowText(element: HtmlElement): string {
  return element.children
    .map((child) => (child.kind === "text" ? child.text : isCallout(child) ? "" : rowText(child)))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function isMenuContainer(element: HtmlElement): boolean {
  const role = element.attrs.get("role") ?? "";
  return (
    element.tag === "menu" ||
    role === "menu" ||
    role === "menubar" ||
    classList(element).some((name) => MENU_CLASSES.has(name))
  );
}

function isPopover(element: HtmlElement): boolean {
  return classList(element).some((name) => POPOVER_CLASSES.has(name));
}

/** Carets, opener notes and callout markers are drawing aids, not menu rows. */
function isDrawingAid(element: HtmlElement): boolean {
  if (["script", "style", "template"].includes(element.tag)) return true;
  return isCallout(element) || classList(element).some((name) => name === "from" || name.startsWith("caret"));
}

const hasOwnText = (element: HtmlElement) =>
  element.children.some((child) => child.kind === "text" && child.text.trim());

/** A wrapper holds rows (block children) and no text of its own, such as a group, a list or a section. */
function isWrapper(element: HtmlElement): boolean {
  if (CONTROL_TAGS.has(element.tag)) return false;
  return !hasOwnText(element) && childElements(element).some((child) => BLOCK_TAGS.has(child.tag));
}

function classifyMenuEntry(element: HtmlElement): MenuEntryKind | null {
  const role = element.attrs.get("role") ?? "";
  const classes = classList(element);
  if (element.tag === "hr" || role === "separator" || classes.some((name) => SEPARATOR_CLASS.test(name)))
    return "separator";
  const text = rowText(element);
  if (!text && !childElements(element).length) return null;
  if (/^h[1-6]$/.test(element.tag) || ["dt", "legend"].includes(element.tag) || role === "heading") return "heading";
  if (classes.some((name) => HEADING_CLASS.test(name))) return "heading";
  const style = element.attrs.get("style") ?? "";
  const command =
    ITEM_ROLES.has(role) ||
    CONTROL_TAGS.has(element.tag) ||
    findAll(
      element,
      (child) =>
        child.tag === "kbd" || CONTROL_TAGS.has(child.tag) || ["sp", "btn", "in"].some((name) => hasClass(child, name)),
    ).length > 0 ||
    /…|\.\.\./.test(text) ||
    CHOICE_GLYPH.test(text) ||
    classes.some((name) => ["danger", "bad", "destructive"].includes(name)) ||
    /var\(--bad\)/.test(style);
  if (command) return "item";
  const shown = childElements(element).filter((child) => !isCallout(child));
  const emphasized =
    EMPHASIS_TAGS.has(element.tag) || (!hasOwnText(element) && shown.length === 1 && EMPHASIS_TAGS.has(shown[0].tag));
  const muted = classes.some((name) => MUTED_CLASS.test(name)) || MUTED_STYLE.test(style);
  return emphasized || muted ? "label" : "item";
}

/**
 * Flattens a menu's rows in reading order. Inline content between rows forms one line, as a browser lays it out; a
 * wrapper's first row starts a group and its end closes one; nested menus and popovers are checked on their own.
 */
function menuEntries(container: HtmlElement): MenuEntry[] {
  const entries: MenuEntry[] = [];
  let startNext = true;
  const add = (element: HtmlElement) => {
    const kind = classifyMenuEntry(element);
    if (!kind) return;
    entries.push({ kind, element, groupStart: startNext });
    startNext = kind === "separator";
  };
  const visit = (parent: HtmlElement) => {
    let line: HtmlNode[] = [];
    const flush = () => {
      const first = line.find((node) => node.kind === "element" || node.text.trim());
      if (first) add({ kind: "element", tag: "#line", attrs: new Map(), line: first.line, parent, children: line });
      line = [];
    };
    for (const child of parent.children) {
      if (child.kind === "element" && (isDrawingAid(child) || isMenuContainer(child) || isPopover(child))) continue;
      if (child.kind === "text" || !(BLOCK_TAGS.has(child.tag) || CONTROL_TAGS.has(child.tag))) {
        line.push(child);
        continue;
      }
      flush();
      if (isWrapper(child)) {
        startNext = true;
        visit(child);
        entries.push({ kind: "separator", element: child, groupStart: false });
        startNext = true;
      } else add(child);
    }
    flush();
  };
  visit(container);
  return entries;
}

/**
 * Finds group headings that label fewer than two items, whatever markup draws them. A heading is explicit (a heading
 * tag, role or class name) anywhere in the menu, or inferred where a group starts: a muted or wholly emphasized row
 * with no command affordance. Inferring only at group starts keeps dimmed items between highlighted ones from reading
 * as headings. A first row followed by a heading or separator is the menu's target header, and a label-like row with
 * no item under it is a note; neither is a group heading. A popover counts as a menu only when it has group structure
 * or command affordances, so value pickers and forms are left alone.
 */
function checkMenuHeadings(page: Page, findings: Finding[]): void {
  for (const container of findAll(page.root, (element) => isMenuContainer(element) || isPopover(element))) {
    const entries = menuEntries(container);
    const menuLike =
      isMenuContainer(container) ||
      entries.some(({ kind }) => kind === "separator" || kind === "heading") ||
      entries.some(
        ({ kind, element }) =>
          kind === "item" &&
          (findAll(element, (child) => child.tag === "kbd").length > 0 ||
            /…|\.\.\./.test(rowText(element)) ||
            ITEM_ROLES.has(element.attrs.get("role") ?? "") ||
            /var\(--bad\)/.test(element.attrs.get("style") ?? "")),
      );
    if (!menuLike) continue;
    entries.forEach(({ kind, element, groupStart }, index) => {
      if (kind !== "heading" && !(kind === "label" && groupStart)) return;
      let items = 0;
      while (entries[index + 1 + items]?.kind === "item") items++;
      if (items === 0 && (kind === "label" || (index === 0 && entries[index + 1]))) return;
      if (items >= 2) return;
      findings.push({
        file: page.path,
        line: element.line,
        severity: "error",
        rule: "menu-heading",
        message: `menu heading "${rowText(element)}" labels ${items} item(s); a heading labels two or more, so fold a lone item into its closest group or drop the heading`,
      });
    });
  }
}

function checkMenus(page: Page, findings: Finding[]): void {
  checkMenuHeadings(page, findings);
  for (const surface of findAll(page.root, (element) => hasClass(element, "popover") || hasClass(element, "menu"))) {
    const hasCaret = findAll(
      surface,
      (element) => hasClass(element, "caret-up") || hasClass(element, "caret-dn"),
    ).length;
    if (!hasCaret || !isMockupElement(surface)) continue;
    const window =
      closest(surface, (element) => hasClass(element, "win")) ??
      closest(surface, (element) => hasClass(element, "step"));
    if (window && !findAll(window, (element) => hasClass(element, "open")).length) {
      findings.push({
        file: page.path,
        line: surface.line,
        severity: "error",
        rule: "popover-trigger",
        message: "a popover or menu with a caret needs its trigger drawn in the same mockup with the .open outline",
      });
    }
  }
  for (const toast of findAll(page.root, (element) => hasClass(element, "toast"))) {
    const decision = findAll(
      toast,
      (element) => hasClass(element, "btn") || ["button", "input", "select"].includes(element.tag),
    );
    if (decision.length) {
      findings.push({
        file: page.path,
        line: decision[0].line,
        severity: "error",
        rule: "toast-action",
        message: "toasts carry a status sentence and links only; move decisions into a panel, popover or dialog",
      });
    }
  }
}

function linkTargets(page: Page): { element: HtmlElement; value: string }[] {
  const targets: { element: HtmlElement; value: string }[] = [];
  for (const element of descendants(page.root)) {
    const attribute =
      element.tag === "a" || element.tag === "link"
        ? "href"
        : element.tag === "img" || element.tag === "script"
          ? "src"
          : null;
    const value = attribute ? element.attrs.get(attribute) : undefined;
    if (value !== undefined) targets.push({ element, value });
  }
  return targets;
}

function idsOf(root: HtmlElement): Set<string> {
  return new Set(findAll(root, (element) => element.attrs.has("id")).map((element) => element.attrs.get("id") ?? ""));
}

function checkLinks(page: Page, options: LintOptions, findings: Finding[], parsed: Map<string, HtmlElement>): void {
  const add = (line: number, message: string) =>
    findings.push({ file: page.path, line, severity: "error", rule: "link", message });
  for (const { element, value } of linkTargets(page)) {
    if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) continue;
    const [withoutFragment, fragment] = value.split("#", 2);
    const pathPart = withoutFragment.split("?")[0];
    if (!pathPart) {
      if (fragment && !idsOf(page.root).has(decodeURIComponent(fragment)))
        add(element.line, `#${fragment} matches no id on this page`);
      continue;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathPart);
    } catch {
      add(element.line, `${value} is not a valid URL path`);
      continue;
    }
    if (decoded.startsWith("/") && !options.siteRoot) continue;
    const target = decoded.startsWith("/")
      ? join(resolve(options.siteRoot ?? "."), decoded)
      : resolve(dirname(page.path), decoded);
    if (!existsSync(target)) {
      add(element.line, `${value} does not exist (${target})`);
      continue;
    }
    if (statSync(target).isDirectory()) {
      const index = ["index.html", "index.md"].find((name) => existsSync(join(target, name)));
      if (!index) add(element.line, `${value} is a directory without an index page; link a page instead`);
      continue;
    }
    if (!fragment || !target.endsWith(".html")) continue;
    let targetRoot = parsed.get(target);
    if (!targetRoot) {
      targetRoot = parseHtml(readFileSync(target, "utf8"));
      parsed.set(target, targetRoot);
    }
    if (!idsOf(targetRoot).has(decodeURIComponent(fragment)))
      add(element.line, `${value}: #${fragment} matches no id in ${basename(target)}`);
  }
}

function checkNavigation(page: Page, findings: Finding[]): void {
  const key = basename(page.path, ".html");
  const nav = findAll(page.root, (element) => element.tag === "nav" && hasClass(element, "top"))[0];
  const add = (severity: Severity, rule: string, message: string) =>
    findings.push({ file: page.path, line: nav?.line ?? 1, severity, rule, message });
  if (!nav) {
    add(
      "error",
      "nav",
      "flow pages start with a nav.top linking the index, both diagrams, the proposal and the ticket",
    );
    return;
  }
  const hrefs = findAll(nav, (element) => element.tag === "a").map((link) => link.attrs.get("href") ?? "");
  const required: [string, (href: string) => boolean][] = [
    ["the wireframe index", (href) => /(^|\/)index\.html$/.test(href)],
    ["the current-flow diagram", (href) => href.endsWith(`${key}-current.html`)],
    ["the proposed-flow diagram", (href) => href.endsWith(`${key}-proposed.html`)],
    ["the written proposal", (href) => href.endsWith(`proposals/${key}.md`)],
  ];
  for (const [label, matches] of required) {
    if (!hrefs.some(matches)) add("error", "nav", `nav.top lacks a link to ${label}`);
  }
  if (!hrefs.some((href) => /^https?:\/\//.test(href) || /(^|\/)tickets\//.test(href))) {
    add(
      "warning",
      "nav-ticket",
      "nav.top lacks a link to the redesign ticket (a tracker URL or a tickets/<id>.md page)",
    );
  }
}

function checkDocument(page: Page, findings: Finding[]): void {
  const headings = findAll(page.root, (element) => element.tag === "h1");
  if (headings.length !== 1) {
    findings.push({
      file: page.path,
      line: headings[1]?.line ?? 1,
      severity: "error",
      rule: "h1",
      message: `pages have exactly one h1 (found ${headings.length})`,
    });
  }
  const seen = new Map<string, number>();
  for (const element of findAll(page.root, (candidate) => candidate.attrs.has("id"))) {
    const id = element.attrs.get("id") ?? "";
    if (seen.has(id)) {
      findings.push({
        file: page.path,
        line: element.line,
        severity: "error",
        rule: "duplicate-id",
        message: `id "${id}" is already used on line ${seen.get(id)}`,
      });
    } else seen.set(id, element.line);
  }
  page.source.split("\n").forEach((text, index) => {
    for (const match of text.matchAll(/\{\{\s*[A-Z0-9_]+\s*\}\}/g)) {
      findings.push({
        file: page.path,
        line: index + 1,
        severity: "error",
        rule: "placeholder",
        message: `template placeholder ${match[0]} was not filled in`,
      });
    }
  });
}

/** Lints a set of wireframe pages that share one linked stylesheet and one design language. */
export function lintWireframes(paths: string[], options: LintOptions = {}): Finding[] {
  const findings: Finding[] = [];
  const stylesheetName = options.stylesheet ?? "wireframe.css";
  const pages: Page[] = paths.map((path) => {
    const source = readFileSync(path, "utf8");
    return { path, source, root: parseHtml(source) };
  });
  const parsed = new Map(pages.map((page) => [resolve(page.path), page.root]));
  const sheets = new Map<string, Set<string>>();
  const linkedSheets = new Set<string>();

  for (const page of pages) {
    const links = findAll(
      page.root,
      (element) => element.tag === "link" && (element.attrs.get("rel") ?? "").split(/\s+/).includes("stylesheet"),
    ).filter((link) => basename((link.attrs.get("href") ?? "").split(/[?#]/)[0]) === stylesheetName);
    if (!links.length) {
      findings.push({
        file: page.path,
        line: findAll(page.root, (element) => element.tag === "head")[0]?.line ?? 1,
        severity: "error",
        rule: "stylesheet",
        message: `the page does not link the shared stylesheet (<link rel="stylesheet" href="${stylesheetName}">)`,
      });
    }
    let tokens = new Set<string>();
    for (const link of links) {
      const href = (link.attrs.get("href") ?? "").split(/[?#]/)[0];
      if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) continue;
      const sheet = href.startsWith("/")
        ? join(resolve(options.siteRoot ?? "."), href)
        : resolve(dirname(page.path), href);
      if (!existsSync(sheet)) continue;
      linkedSheets.add(sheet);
      if (!sheets.has(sheet)) {
        const rules = readCssRules(readFileSync(sheet, "utf8"));
        const sheetTokens = rootTokens(rules);
        sheets.set(sheet, sheetTokens);
        const sheetFile = relative(process.cwd(), sheet) || sheet;
        checkCss(rules, sheetFile, findings);
        if (!sheetTokens.has("--font")) {
          findings.push({
            file: sheetFile,
            line: 1,
            severity: "error",
            rule: "font-token",
            message: "the shared stylesheet must define the --font token in :root",
          });
        }
      }
      tokens = sheets.get(sheet) ?? tokens;
    }
    const { rules, styles } = pageCss(page);
    checkCss(rules, page.path, findings);
    for (const rule of rules) {
      for (const declaration of rule.declarations) {
        if (!tokens.has(declaration.property)) continue;
        findings.push({
          file: page.path,
          line: declaration.line,
          severity: "error",
          rule: "token-redefined",
          message: `${declaration.property} is a shared stylesheet token; change it in ${stylesheetName}, not in the page`,
        });
      }
    }
    for (const style of styles) {
      if (!COPIED_BLOCK_MARKER.test(textContent(style))) continue;
      findings.push({
        file: page.path,
        line: style.line,
        severity: "error",
        rule: "copied-block",
        message: `remove the copied wireframe-css block; link ${stylesheetName} and keep only page-specific rules here`,
      });
    }
    const isMockupPage = findAll(page.root, (element) => hasClass(element, "step")).length > 0;
    if (isMockupPage) {
      checkSteps(page, findings);
      checkLegend(page, findings);
      if (!["patterns.html", "index.html"].includes(basename(page.path))) checkNavigation(page, findings);
    }
    checkMenus(page, findings);
    checkLinks(page, options, findings, parsed);
    checkDocument(page, findings);
  }
  if (linkedSheets.size > 1) {
    findings.push({
      file: [...linkedSheets].sort()[0],
      line: 1,
      severity: "warning",
      rule: "stylesheet",
      message: `pages link ${linkedSheets.size} different copies of ${stylesheetName}; link one shared file`,
    });
  }
  return findings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) || left.line - right.line || left.rule.localeCompare(right.rule),
  );
}
