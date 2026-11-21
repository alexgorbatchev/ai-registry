# Project config and state

- [Where state lives](#where-state-lives)
- [The config](#the-config)
- [The slice plan](#the-slice-plan)

## Where state lives

The implementation run keeps its records in the redesign run's state directory, `<state>`: `<app-root>/.ux-flow-redesign/`, committed to the project (in a public project whose commits must not carry tracker identity, the machine-local copy the redesign run used instead). `<local>` is the machine-local directory for screenshots and other bulky evidence, never committed.

| Record | Path |
| --- | --- |
| Project config | `<state>/implementation/config.json` |
| Slice plan, epic body, slice record | `<state>/implementation/slices-plan.json`, `epic.md`, `slices.json` |
| Run log: waves, measurements, deploys, reviews | `<state>/implementation/run.md` |
| Blind and chrome reviews | `<state>/implementation/reviews/wave-<n>[-chrome].{manifest,review}.json` |
| Unit checkpoints | `<local>/units/impl-<ticket>.json` |
| Screenshots | `<local>/shots/impl-<ticket>/`, `<local>/shots/wave-<n>-chrome/` |

Unit checkpoints stay machine-local so a unit's writes never dirty a checkout; what outlives the machine is on the tickets and in the run log. Commit the other records with each wave's log entry and whenever the slice record changes, from a worktree, never the main checkout. Give units absolute paths.

## The config

Hold project facts only: paths, commands, hosts and the deploy recipe. Policy lives in this skill and the shared instructions; keep rules, lane counts and preferences out, and put a project rule units must follow in the project's instructions, which every unit reads. Start from [the example](../assets/config.example.json); its fields are typed and described in [config.ts](../scripts/lib/config.ts). Validate with `bun <skill>/scripts/render-brief.ts --config <config> --check`.

| Field | Holds |
| --- | --- |
| `product`, `tracker` | Name used in ticket titles; issue-tracker project and labels for slice tickets |
| `repository` | Remote, target branch, web link prefix (omit when tickets must not link the repository), commit subject suffix (omit when commits must not carry ticket numbers), and the landing command or `pull request` |
| `instructions` | Project instruction files every unit reads |
| `design` | Proposals and wireframes directories, the pattern reference, further design rules blind reviewers read |
| `source` | Label to code path, such as frontend and backend |
| `worktree` | Worktree directory, setup commands, the lockfile reinstall and caches to clear after copied dependencies |
| `preview` | Start command and per-unit host (`{unit}` fills in), its guide, development overlay selectors, how to seed data, other facts about running it |
| `checks` | Targeted test commands for iteration; the final gate, which runs the tests the unit's whole change affects against its base (such as `just test-affected`), not the full suite; coverage |
| `library` | Shared component library: name, checkout and release recipe; omit when there is none |
| `deploy` | Production URL, deploy commands, where they run, how a browser reaches production; omit when the project does not deploy from the run |
| `qa.screens` | Main screens of the persistent chrome review, as paths under the app URL |
| `disk.volume`, `localDir` | Volume holding worktrees and build output; the screenshot root (`~` allowed) |

Strings may use `{unit}` (the unit key) and `{ticket}` (left as `<ticket>` for the unit to fill).

## The slice plan

`slices-plan.json` tells [file-slices.ts](../scripts/file-slices.ts) what to file; its schema is in [slices.ts](../scripts/lib/slices.ts):

- `epic`: title, the body file (`epic.md`, written from [the queue mandate](../assets/queue-mandate.md)), and extra tickets to add besides the redesigns.
- `priority`: the default `P0`–`P3` of slice tickets.
- `flows`: per redesigned flow, its key (the proposal's file name), its redesign ticket and a short prefix; slice keys are `<prefix>-<n>`.
- `blockers`: cross-flow waits the proposals state in prose (their Seams and slice notes), by slice key: other slice keys, suite keys, or existing tickets as `#<n>`. Each slice already waits for the previous slice of its flow.
- `suites`: journeys whose slices belong to other flows: one ticket each, with a title, the slices it exercises as `blockedBy`, and an optional priority.

A proposal is sliceable when its `## Recommended priority` section lists each slice as `<n>. **<Name>** <detail>` and names cross-flow seams in a paragraph starting `Seams`. When one lists its slices only in prose, add that list to the proposal from its own prose and land the edit before filing, so the slice tickets and the proposal agree.
