import { findAll, hasClass, parseHtml, textContent } from "./html";

/** A finding citation: a ticket label (`#412`), a tracker key (`OPS-12`) or a finding ID (`bulk-edit-01`). */
const CITATION = /#\d+|\b[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*-\d+\b/g;
const RESOLVES = /^(\s*)(?:[-*+]\s+)?(?:\*\*)?Resolves:?(?:\*\*)?:?/;

const citations = (text: string) => new Set(text.match(CITATION) ?? []);

/**
 * The findings a wireframe's `p.fixes` lines cite: the text after "Fixes" up to the first "·", which separates the
 * findings from the backend work the step needs.
 */
export function readWireframeFixes(html: string): Set<string> {
  const cited = new Set<string>();
  for (const line of findAll(parseHtml(html), (element) => element.tag === "p" && hasClass(element, "fixes"))) {
    const match = /\bFixes\b([^·]*)/.exec(textContent(line));
    if (match) for (const citation of citations(match[1])) cited.add(citation);
  }
  return cited;
}

/**
 * The findings under a ticket body's or proposal's `Resolves:` entry, with its continuation and nested lines.
 * Parenthesized notes, such as which redesign resolves the rest of a partial cover, are not resolved here.
 */
export function readResolvedCitations(markdown: string): Set<string> | null {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((line) => RESOLVES.test(line));
  if (start < 0) return null;
  const indent = RESOLVES.exec(lines[start])?.[1].length ?? 0;
  const entry = [lines[start].replace(RESOLVES, "")];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim() || line.length - line.trimStart().length <= indent) break;
    entry.push(line);
  }
  return citations(entry.join(" ").replace(/\([^()]*\)/g, " "));
}

/** Compares a wireframe's Fixes lines with the findings a ticket body (or the proposal it copies) resolves. */
export function compareFixes(wireframeHtml: string, ticketBody: string): string[] {
  const resolved = readResolvedCitations(ticketBody);
  if (!resolved) return ["the ticket body has no Resolves: entry in its covers"];
  const fixed = readWireframeFixes(wireframeHtml);
  return [
    ...[...fixed]
      .filter((citation) => !resolved.has(citation))
      .map((citation) => `the wireframe's Fixes lines cite ${citation}, which the ticket's Resolves does not list`),
    ...[...resolved]
      .filter((citation) => !fixed.has(citation))
      .map((citation) => `the ticket resolves ${citation}, which no Fixes line in the wireframe cites`),
  ];
}
