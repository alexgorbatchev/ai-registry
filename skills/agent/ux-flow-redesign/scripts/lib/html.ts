// Minimal, dependency-free HTML parser for hand-written wireframe pages and served documentation.
// It keeps source line numbers, applies the implied end tags these pages rely on, and treats
// script, style, textarea and title content as raw text.

export interface HtmlElement {
  kind: "element";
  tag: string;
  attrs: Map<string, string>;
  line: number;
  parent: HtmlElement | null;
  children: HtmlNode[];
}

export interface HtmlText {
  kind: "text";
  text: string;
  line: number;
  parent: HtmlElement;
}

export type HtmlNode = HtmlElement | HtmlText;

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);
const RAW_TEXT_TAGS = new Set(["script", "style", "textarea", "title"]);
const P_CLOSERS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "div",
  "dl",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "main",
  "menu",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);
const SCOPE_BOUNDARIES = new Set(["html", "body", "table", "td", "th", "caption", "button", "template"]);
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

function createLineIndex(source: string): (offset: number) => number {
  const starts = [0];
  for (let index = 0; index < source.length; index++) if (source[index] === "\n") starts.push(index + 1);
  return (offset) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
}

function parseAttributes(text: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of text.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (attrs.has(name)) continue;
    attrs.set(name, decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return attrs;
}

/** Parses an HTML document into a tree rooted at a synthetic `#document` element. */
export function parseHtml(source: string): HtmlElement {
  const lineOf = createLineIndex(source);
  const root: HtmlElement = {
    kind: "element",
    tag: "#document",
    attrs: new Map(),
    line: 1,
    parent: null,
    children: [],
  };
  const stack: HtmlElement[] = [root];
  const current = () => stack[stack.length - 1];

  const popUntil = (predicate: (element: HtmlElement) => boolean, boundaries: Set<string>) => {
    for (let index = stack.length - 1; index > 0; index--) {
      const element = stack[index];
      if (predicate(element)) {
        stack.length = index;
        return;
      }
      if (boundaries.has(element.tag)) return;
    }
  };

  const applyImpliedEnds = (tag: string) => {
    if (P_CLOSERS.has(tag)) popUntil((element) => element.tag === "p", SCOPE_BOUNDARIES);
    if (tag === "li") popUntil((element) => element.tag === "li", new Set(["ul", "ol", ...SCOPE_BOUNDARIES]));
    if (tag === "dt" || tag === "dd") {
      popUntil((element) => element.tag === "dt" || element.tag === "dd", new Set(["dl", ...SCOPE_BOUNDARIES]));
    }
    if (tag === "option") popUntil((element) => element.tag === "option", new Set(["select", "datalist"]));
    if (tag === "td" || tag === "th") {
      popUntil((element) => element.tag === "td" || element.tag === "th", new Set(["tr", "table"]));
    }
    if (tag === "tr") popUntil((element) => element.tag === "tr", new Set(["table", "thead", "tbody", "tfoot"]));
    if (tag === "thead" || tag === "tbody" || tag === "tfoot") {
      popUntil((element) => ["thead", "tbody", "tfoot"].includes(element.tag), new Set(["table"]));
    }
  };

  const appendText = (text: string, offset: number) => {
    if (!text) return;
    current().children.push({ kind: "text", text: decodeEntities(text), line: lineOf(offset), parent: current() });
  };

  const lower = source.toLowerCase();
  const endTagPattern = /<\/([a-zA-Z][^\s/>]*)\s*>/y;
  const startTagPattern =
    /<([a-zA-Z][^\s/>]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/y;
  let position = 0;
  while (position < source.length) {
    const open = source.indexOf("<", position);
    if (open === -1) {
      appendText(source.slice(position), position);
      break;
    }
    appendText(source.slice(position, open), position);
    if (source.startsWith("<!--", open)) {
      const end = source.indexOf("-->", open + 4);
      position = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source[open + 1] === "!" || source[open + 1] === "?") {
      const end = source.indexOf(">", open);
      position = end === -1 ? source.length : end + 1;
      continue;
    }
    endTagPattern.lastIndex = open;
    const endTag = endTagPattern.exec(source);
    if (endTag) {
      const tag = endTag[1].toLowerCase();
      if (stack.some((element) => element.tag === tag)) popUntil((element) => element.tag === tag, new Set());
      position = open + endTag[0].length;
      continue;
    }
    startTagPattern.lastIndex = open;
    const startTag = startTagPattern.exec(source);
    if (!startTag) {
      appendText("<", open);
      position = open + 1;
      continue;
    }
    const tag = startTag[1].toLowerCase();
    applyImpliedEnds(tag);
    const element: HtmlElement = {
      kind: "element",
      tag,
      attrs: parseAttributes(startTag[2]),
      line: lineOf(open),
      parent: current(),
      children: [],
    };
    current().children.push(element);
    position = open + startTag[0].length;
    if (VOID_TAGS.has(tag) || startTag[3] === "/") continue;
    if (RAW_TEXT_TAGS.has(tag)) {
      const close = lower.indexOf(`</${tag}`, position);
      const end = close === -1 ? source.length : close;
      const text = source.slice(position, end);
      if (text)
        element.children.push({
          kind: "text",
          text: tag === "title" ? decodeEntities(text) : text,
          line: lineOf(position),
          parent: element,
        });
      const closeEnd = close === -1 ? source.length : source.indexOf(">", close);
      position = closeEnd === -1 ? source.length : closeEnd + 1;
      continue;
    }
    stack.push(element);
  }
  return root;
}

export function classesOf(element: HtmlElement): Set<string> {
  return new Set((element.attrs.get("class") ?? "").split(/\s+/).filter(Boolean));
}

export function hasClass(element: HtmlElement, name: string): boolean {
  return classesOf(element).has(name);
}

export function* descendants(element: HtmlElement): Generator<HtmlElement> {
  for (const child of element.children) {
    if (child.kind !== "element") continue;
    yield child;
    yield* descendants(child);
  }
}

export function findAll(element: HtmlElement, predicate: (candidate: HtmlElement) => boolean): HtmlElement[] {
  return [...descendants(element)].filter(predicate);
}

export function childElements(element: HtmlElement): HtmlElement[] {
  return element.children.filter((child): child is HtmlElement => child.kind === "element");
}

export function textContent(element: HtmlElement): string {
  return element.children.map((child) => (child.kind === "text" ? child.text : textContent(child))).join("");
}

export function closest(element: HtmlElement, predicate: (candidate: HtmlElement) => boolean): HtmlElement | null {
  for (let candidate: HtmlElement | null = element; candidate; candidate = candidate.parent) {
    if (predicate(candidate)) return candidate;
  }
  return null;
}
