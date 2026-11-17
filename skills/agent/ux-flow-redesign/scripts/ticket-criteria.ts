#!/usr/bin/env bun
// Keeps a redesign ticket in line with its proposal and wireframe. Usage:
//   bun ticket-criteria.ts print <proposal.md>                  prints the proposal's criteria to paste into the ticket
//   bun ticket-criteria.ts check <proposal.md> <ticket.md|->    checks the ticket carries those criteria verbatim
//   bun ticket-criteria.ts fixes <wireframe.html> <ticket.md|-> checks the wireframe's Fixes lines cite exactly the
//                                                               findings under the ticket's Resolves
// A ticket body is a file, or - for standard input. print exits 1 when the proposal has no filled criteria; check and
// fixes print OK and exit 0 when they match, and otherwise print every difference and exit 1.
import { compareCriteria, printableCriteria } from "./lib/ticketCriteria";
import { compareFixes } from "./lib/ticketFixes";

const USAGE =
  "usage: bun ticket-criteria.ts print <proposal.md> | check <proposal.md> <ticket-body.md|-> | fixes <wireframe.html> <ticket-body.md|->";
const [mode, firstFile, ticketFile, ...rest] = Bun.argv.slice(2);

if (mode === "-h" || mode === "--help") {
  console.log(USAGE);
  process.exit(0);
}
const arity = mode === "print" ? 1 : mode === "check" || mode === "fixes" ? 2 : -1;
if ([firstFile, ticketFile].filter(Boolean).length !== arity || rest.length) {
  console.log(USAGE);
  process.exit(2);
}

async function read(file: string): Promise<string> {
  try {
    return file === "-" ? await Bun.stdin.text() : await Bun.file(file).text();
  } catch (error) {
    console.error(`ERR: ${file} is not readable: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function finish(problems: string[], ok: string): void {
  for (const problem of problems) console.error(`ERR: ${problem}`);
  if (problems.length) process.exit(1);
  console.log(`OK: ${ok}`);
}

const first = await read(firstFile);
if (mode === "print") {
  const { text, problems } = printableCriteria(first);
  for (const problem of problems) console.error(`ERR: ${firstFile}: ${problem}`);
  if (problems.length) process.exit(1);
  console.log(text);
} else if (mode === "check") {
  finish(
    compareCriteria(first, await read(ticketFile)),
    `${ticketFile} carries the acceptance criteria of ${firstFile} verbatim`,
  );
} else {
  finish(
    compareFixes(first, await read(ticketFile)),
    `${firstFile} Fixes lines cite exactly the findings ${ticketFile} resolves`,
  );
}
