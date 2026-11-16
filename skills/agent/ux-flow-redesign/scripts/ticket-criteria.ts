#!/usr/bin/env bun
// Keeps a redesign ticket's acceptance criteria identical to its proposal's. Usage:
//   bun ticket-criteria.ts print <proposal.md>               prints the proposal's criteria to paste into the ticket
//   bun ticket-criteria.ts check <proposal.md> <ticket.md|-> checks a ticket body (a file, or - for standard input)
// print exits 1 when the proposal has no filled criteria; check prints OK and exits 0 when the ticket carries the
// proposal's criteria verbatim and in order, and otherwise prints every difference and exits 1.
import { compareCriteria, printableCriteria } from "./lib/ticketCriteria";

const USAGE = "usage: bun ticket-criteria.ts print <proposal.md> | check <proposal.md> <ticket-body.md|->";
const [mode, proposalFile, ticketFile, ...rest] = Bun.argv.slice(2);

if (mode === "-h" || mode === "--help") {
  console.log(USAGE);
  process.exit(0);
}
const arity = mode === "print" ? 1 : mode === "check" ? 2 : -1;
if ([proposalFile, ticketFile].filter(Boolean).length !== arity || rest.length) {
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

const proposal = await read(proposalFile);
if (mode === "print") {
  const { text, problems } = printableCriteria(proposal);
  for (const problem of problems) console.error(`ERR: ${proposalFile}: ${problem}`);
  if (problems.length) process.exit(1);
  console.log(text);
} else {
  const problems = compareCriteria(proposal, await read(ticketFile));
  for (const problem of problems) console.error(`ERR: ${problem}`);
  if (problems.length) process.exit(1);
  console.log(`OK: ${ticketFile} carries the acceptance criteria of ${proposalFile} verbatim`);
}
