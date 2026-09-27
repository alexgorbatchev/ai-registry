#!/usr/bin/env bun
// Deterministic pre-review gate. The coordinator runs it on an issue worktree before spawning any reviewer.
// A failure goes straight back to the worker; no reviewer tokens are spent.
//
// Usage:
//   bun review-gate.ts --worktree <path> --base <branch> --check "<final gate command>"
//     [--fmt "<ext>=<command that lists unformatted files given paths>"]...   e.g. --fmt ".go=gofmt -l"
//     [--pair "<dirA>/*.<extA>=<dirB>/*.<extB>"]...                           e.g. --pair "testdata/*.golden=testdata-ansi/*.ansi"
//     [--solo-ok "<ext>"]...   a change to only this side of a pair is accepted, because the final gate compares the
//                              OTHER side on every run (e.g. --solo-ok ".ansi" when tests always compare .golden)
//     [--evidence <path>]      worker evidence file; a one-sided paired change passes only if this file names its path
//     [--log <path>]                                                        default <worktree>/.tmp/gate-check.log
//     [--skip-check]
// Exit codes: 0 pass, 1 gate failed, 2 usage error.
import { $ } from "bun";
import { basename, dirname, join } from "node:path";

type Pair = { dirA: string; extA: string; dirB: string; extB: string };

function usage(message: string): never {
  console.error(`review-gate: ${message}`);
  console.error('usage: bun review-gate.ts --worktree <path> --base <branch> --check "<cmd>" [--fmt ".ext=<cmd>"]... [--pair "dirA/*.extA=dirB/*.extB"]... [--solo-ok ".ext"]... [--evidence <path>] [--log <path>] [--skip-check]');
  process.exit(2);
}

function parseArgs(argv: string[]) {
  const fmt: Array<{ ext: string; cmd: string }> = [];
  const pairs: Pair[] = [];
  const soloOk: string[] = [];
  let worktree = "";
  let base = "";
  let check = "";
  let log = "";
  let evidence = "";
  let skipCheck = false;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) usage(`${flag} needs a value`);
      return v;
    };
    switch (flag) {
      case "--worktree": worktree = value(); break;
      case "--base": base = value(); break;
      case "--check": check = value(); break;
      case "--log": log = value(); break;
      case "--evidence": evidence = value(); break;
      case "--solo-ok": {
        const v = value();
        if (!v.startsWith(".")) usage(`bad --solo-ok "${v}"; expected ".ext"`);
        soloOk.push(v);
        break;
      }
      case "--skip-check": skipCheck = true; break;
      case "--fmt": {
        const v = value();
        const eq = v.indexOf("=");
        if (eq <= 1 || !v.startsWith(".")) usage(`bad --fmt "${v}"; expected ".ext=<cmd>"`);
        fmt.push({ ext: v.slice(0, eq), cmd: v.slice(eq + 1) });
        break;
      }
      case "--pair": {
        const m = value().match(/^([^=*]+)\/\*(\.[^=]+)=([^=*]+)\/\*(\.[^=]+)$/);
        if (!m) usage(`bad --pair; expected "dirA/*.extA=dirB/*.extB"`);
        pairs.push({ dirA: m[1], extA: m[2], dirB: m[3], extB: m[4] });
        break;
      }
      default: usage(`unknown argument ${flag}`);
    }
  }
  if (!worktree) usage("--worktree is required");
  if (!base) usage("--base is required");
  if (!check && !skipCheck) usage("--check is required unless --skip-check");
  return { worktree, base, check, log: log || join(worktree, ".tmp", "gate-check.log"), skipCheck, fmt, pairs, evidence, soloOk };
}

// For a changed path, return the path of its paired counterpart, if the path matches a pair rule.
function counterpart(path: string, pairs: Pair[]): string | undefined {
  const dir = dirname(path);
  const parent = dirname(dir);
  const leaf = basename(dir);
  const name = basename(path);
  for (const p of pairs) {
    if (leaf === p.dirA && name.endsWith(p.extA)) return join(parent, p.dirB, name.slice(0, -p.extA.length) + p.extB);
    if (leaf === p.dirB && name.endsWith(p.extB)) return join(parent, p.dirA, name.slice(0, -p.extB.length) + p.extA);
  }
  return undefined;
}

const args = parseArgs(process.argv.slice(2));
const failures: string[] = [];

const dirty = (await $`git -C ${args.worktree} status --porcelain --untracked-files=normal`.text())
  .split("\n")
  .filter((line) => line && !line.slice(3).startsWith(".tmp/"));
if (dirty.length > 0) failures.push(`worktree has uncommitted changes:\n${dirty.join("\n")}`);

const changed = (await $`git -C ${args.worktree} diff --name-only --diff-filter=ACMR ${args.base}...HEAD`.text())
  .split("\n")
  .filter(Boolean);
if (changed.length === 0) failures.push(`no commits with changes on HEAD relative to ${args.base}`);

for (const { ext, cmd } of args.fmt) {
  const files = changed.filter((f) => f.endsWith(ext));
  if (files.length === 0) continue;
  const res = await $`sh -c ${`${cmd} "$@"`} sh ${files}`.cwd(args.worktree).nothrow().quiet();
  const out = `${res.stdout.toString()}${res.stderr.toString()}`.trim();
  if (res.exitCode !== 0 || out) failures.push(`formatter "${cmd}" reports (exit ${res.exitCode}):\n${out}`);
}

const changedSet = new Set(changed);
const evidenceText = args.evidence && (await Bun.file(args.evidence).exists()) ? await Bun.file(args.evidence).text() : "";
for (const f of changed) {
  const pair = counterpart(f, args.pairs);
  const solo = args.soloOk.some((ext) => f.endsWith(ext));
  if (pair && !changedSet.has(pair) && !solo && !evidenceText.includes(f)) {
    const exists = await Bun.file(join(args.worktree, pair)).exists();
    failures.push(`one-sided paired change: ${f} (pair ${pair} ${exists ? "unchanged" : "missing"}); regenerate the pair, or list this path with no-diff evidence in the evidence file`);
  }
}

if (!args.skipCheck && failures.length === 0) {
  await $`mkdir -p ${dirname(args.log)}`;
  const res = await $`sh -c ${`{ ${args.check}\n} > "$1" 2>&1`} sh ${args.log}`.cwd(args.worktree).nothrow().quiet();
  if (res.exitCode !== 0) {
    const tail = (await $`tail -40 ${args.log}`.text()).trim();
    failures.push(`"${args.check}" exited ${res.exitCode}; full log ${args.log}; tail:\n${tail}`);
  }
}

if (failures.length > 0) {
  console.log(`GATE FAILED (${failures.length})\n\n${failures.join("\n\n")}`);
  process.exit(1);
}
console.log(`GATE PASSED: ${changed.length} changed files; formatters clean; pairs complete${args.skipCheck ? "; final gate skipped" : `; "${args.check}" exit 0`}`);
