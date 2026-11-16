/** The content of an "Acceptance criteria" section and its entries in comparable form. */
export interface CriteriaSection {
  /** The section's lines between its heading and the next heading, as written. */
  text: string;
  /** One entry per list item or paragraph, whitespace collapsed and checkboxes unticked. */
  entries: string[];
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const TITLE = /^acceptance criteria:?$/i;
const BOLD_LABEL = /^\*\*([^*]+?):?\*\*:?$/;
const FENCE = /^\s*(```|~~~)/;
const LIST_MARKER = /^([-*+]|\d+[.)])\s/;
const CHECKBOX = /^([-*+]|\d+[.)])\s+\[[ xX]\]/;
/** A heading has no level; the section a bold label opens ends at any heading or the next bold label. */
const LABEL_LEVEL = 7;

/** Finds the first "Acceptance criteria" section, opened by a Markdown heading or a line-wide bold label. */
export function readCriteria(markdown: string): CriteriaSection | null {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let fenced = false;
  let start = -1;
  let level = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (FENCE.test(line)) fenced = !fenced;
    if (fenced) continue;
    const heading = HEADING.exec(line);
    const label = BOLD_LABEL.exec(line.trim());
    if (start < 0) {
      if (heading && TITLE.test(heading[2])) level = heading[1].length;
      else if (label && TITLE.test(label[1])) level = LABEL_LEVEL;
      else continue;
      start = index + 1;
      continue;
    }
    if ((heading && heading[1].length <= level) || (level === LABEL_LEVEL && label)) {
      return section(lines.slice(start, index));
    }
  }
  return start < 0 ? null : section(lines.slice(start));
}

function section(lines: string[]): CriteriaSection {
  const trimmed = lines.map((line) => line.replace(/\s+$/, ""));
  while (trimmed.length && !trimmed[0]) trimmed.shift();
  while (trimmed.length && !trimmed[trimmed.length - 1]) trimmed.pop();
  const blocks: string[][] = [];
  let previousBlank = true;
  for (const line of trimmed) {
    if (!line) {
      previousBlank = true;
      continue;
    }
    const startsBlock = !/^\s/.test(line) && (LIST_MARKER.test(line) || previousBlank);
    if (startsBlock || !blocks.length) blocks.push([line]);
    else blocks[blocks.length - 1].push(line);
    previousBlank = false;
  }
  return {
    text: trimmed.join("\n"),
    entries: blocks.map((block) =>
      block
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(CHECKBOX, (match) => match.replace(/\[[xX]\]$/, "[ ]")),
    ),
  };
}

const quote = (entry: string) => `"${entry.length > 100 ? `${entry.slice(0, 99)}…` : entry}"`;

/** Returns the criteria to paste into a ticket, or the problems that prevent it. */
export function printableCriteria(proposal: string): { text: string; problems: string[] } {
  const criteria = readCriteria(proposal);
  if (!criteria) return { text: "", problems: ["the proposal has no Acceptance criteria section"] };
  if (!criteria.entries.length) return { text: "", problems: ["the proposal's Acceptance criteria section is empty"] };
  if (/\{\{\s*[A-Z0-9_]+\s*\}\}/.test(criteria.text)) {
    return {
      text: "",
      problems: ["the proposal's acceptance criteria still hold template placeholders; fill them first"],
    };
  }
  return { text: criteria.text, problems: [] };
}

/**
 * Compares a ticket body's acceptance criteria with the proposal's. The ticket must carry the proposal's entries
 * verbatim and in order; only line wrapping, surrounding whitespace and ticked checkboxes may differ.
 */
export function compareCriteria(proposal: string, ticketBody: string): string[] {
  const { problems } = printableCriteria(proposal);
  if (problems.length) return problems;
  const expected = readCriteria(proposal)?.entries ?? [];
  const actual = readCriteria(ticketBody)?.entries;
  if (!actual) return ["the ticket body has no Acceptance criteria section; paste the proposal's"];
  const unmatched = [...actual];
  const missing: string[] = [];
  for (const entry of expected) {
    const at = unmatched.indexOf(entry);
    if (at < 0) missing.push(entry);
    else unmatched.splice(at, 1);
  }
  const differences = [
    ...missing.map((entry) => `missing from the ticket: ${quote(entry)}`),
    ...unmatched.map((entry) => `not in the proposal: ${quote(entry)}`),
  ];
  if (!differences.length && actual.some((entry, index) => entry !== expected[index])) {
    differences.push("the ticket lists the proposal's criteria in a different order");
  }
  return differences;
}
