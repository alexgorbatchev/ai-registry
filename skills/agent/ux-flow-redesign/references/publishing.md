# Publishing and verification

- [Where artifacts live](#where-artifacts-live)
- [The docs index](#the-docs-index)
- [Serving](#serving)
- [Docs-site tests](#docs-site-tests)
- [Diagram regeneration recipe](#diagram-regeneration-recipe)
- [Wireframe lint](#wireframe-lint)
- [Link crawl](#link-crawl)
- [Visual evidence](#visual-evidence)
- [Privacy](#privacy)
- [Reporting](#reporting)

Phase 9 makes every design artifact reachable from one served index and proves it with the docs-site tests (or their direct checks), the wireframe linter, a link crawl, the privacy scan and inspected screenshots; [Phase 9](../SKILL.md#phase-9-publish-and-verify) owns the gate. Run commands from the project root: `<skill>` is this skill's directory, `<docs>` the served docs directory, `<state>` the run's permanent state directory and `<origin>` the running server's origin.

## Where artifacts live

- Move design artifacts (diagram specs and renders, proposals, research notes, wireframes, the pattern reference) from scratch into `<docs>/ux-flows/` as soon as the owner, a ticket or another agent needs to see them. Scratch directories get cleaned, sometimes automatically within a day; nothing a ticket or report links may stay there. Delete scratch copies of the owner's private data once they are no longer needed.
- Working files stay under `<state>/` at the paths in [SKILL.md](../SKILL.md#artifact-layout-and-naming); they are not published or linked. Screenshots and diagram images stay under `<state>/shots/<unit-key>/`; never commit image files.
- Keep the diagram tool's delivery receipts (`<docs>/ux-flows/*.delivery.json`) untracked as [Running Archify](diagrams.md#running-archify) requires.
- Every Markdown document in the docs tree starts with front matter in local time, `YYYY-MM-DD HH:MM`. `scaffold-flow.ts` writes it on creation; update `last_modified` on every later edit, including scripted ones:

  ```yaml
  ---
  created_on: 2026-01-05 09:30
  last_modified: 2026-01-05 09:30
  status: current
  ---
  ```

- Never hand-edit or reformat generated diagram HTML, and exclude it from formatters; change the spec and re-render instead.
- Format the other artifacts (proposals, `patterns.md`, wireframes) with the project's own formatter and run its checks before committing. Project rules beat a tool's default habits: when the project forbids shell heredocs, write commit messages to a file and commit with `git commit -F <file>`.
- Who commits, and publishing before filing, follow SKILL.md "Scope boundaries". A flow's publish includes its docs-index rows and any regeneration-recipe change.

## The docs index

`scaffold-flow.ts --init --docs-index <docs>/index.md` appends the "UX flows" section from [docs-index-section.md](../assets/templates/docs-index-section.md) once, rewriting its `ux-flows/` links relative to the index. The section holds:

- An intro naming the review's scope and the reviewed revision as a commit link (current-flow diagrams document that revision), stating that proposed flows are design targets rather than implemented behavior, and linking the pattern reference (`patterns.md` and its visual page) and the wireframe index. The scaffold fills `{{SHORT_REVISION}}` from Git with the HEAD of its repository root; replace it when the diagrams trace another commit, and fill it by hand only without Git. Fill `{{SCOPE_OF_THE_REVIEW}}`, `{{COMMIT_URL}}` and `{{FLOW_GROUP}}` by hand; the scaffold lists them as remaining placeholders. When the origin has no web commit view, write the short SHA in backticks without a link. Replace `{{OPTIONAL_INVENTORY_LINK_OR_DELETE}}` with a link to `ux-flows/inventory.md` when it exists, or delete it; link one written later in the same place.
- One `### <group>` heading and table per flow group (the groups from Phase 1), with columns `Flow | Today | Proposed | Wireframe | Proposal | Redesign`.

Rows:

- `scaffold-flow.ts --key … --docs-index <docs>/index.md` inserts a row directly above `<!-- ux-flows rows: scaffold-flow.ts inserts new rows above this line -->` and skips any flow whose wireframe the index already links. Keep the marker in the table that should receive new rows and move rows to other group tables by hand; a moved row is not inserted again.
- A scaffolded row links both renders, the wireframe and the proposal, and the scaffolded wireframe card and flow-page nav link the diagrams. Replace each link to a file that does not exist yet with "not generated yet" (in the row, the card and the nav), because the crawl fails on it, and restore it once the file exists; until then the flow page also fails the linter's `nav` rule, which the Phase 6 gate catches. Without `--ticket-url` the Redesign cell says "not filed yet"; once filed, replace it as [Linking the ticket](proposals-and-tickets.md#linking-the-ticket) says.
- Link every other page in the tree from the index itself, not only from some page: research notes beside their proposal link, and any page added later. The docs-site tests compare the index's links with the files on disk.

## Serving

Use the first option that applies:

1. **The project's dev runner has a static file service** (for example devhost's `serve` services). Serve the docs with it instead of a custom docs server. Check how it renders Markdown: a runner that renders it in the browser returns the Markdown source as data, with no server-side links or headings, and may leave front matter visible, use its own styling (the Maple Mono font then applies to the HTML pages only) or list a folder without an index instead of returning 404. In that case view the pages through the runner, and keep the template server (option 3) only for the link crawl and the docs-site tests, on a spare loopback port, because both need Markdown rendered on the server.
2. **The project serves its docs another way.** Use that server. Confirm it renders Markdown as HTML pages, serves `.css` as `text/css` and binds to loopback; add what is missing there instead of starting a second server.
3. **Otherwise, the template server** [serve-docs.ts](../assets/templates/serve-docs.ts). When the project's instructions or the request cover docs tooling (see [Docs-site tests](#docs-site-tests)), copy it into the project (for example `scripts/serveDocs.ts`) and run `DOCS_DIR=<docs> PORT=<port> bun scripts/serveDocs.ts`. Otherwise run it in place: `DOCS_DIR=<absolute docs path> PORT=<port> bun <skill>/assets/templates/serve-docs.ts`. `DOCS_TITLE` sets the fallback page title. It:
   - binds to `127.0.0.1` and answers GET and HEAD only (anything else gets 405 with `Allow: GET, HEAD`);
   - serves only `.html`, `.md`, `.css`, `.svg` and `.png` files found under `DOCS_DIR`, so encoded traversal paths and other file types get 404; extend `TYPES` and the glob when pages need other types;
   - answers a path ending in `/` with `index.md`, then `index.html`;
   - renders Markdown with front matter stripped, the title from the first H1, and the Maple Mono font token;
   - reads files on every request, so new pages need no restart;
   - requires Bun's built-in `Bun.markdown`: `bun -e 'console.log(typeof Bun.markdown?.html)'` must print `function`; otherwise upgrade Bun.

Whatever serves the pages must send `.css` as `text/css`; browsers ignore a stylesheet sent with any other type, and every wireframe loses its styles.

Start the server and health-check it as [orchestration](orchestration.md#services) describes before crawling or testing.

## Docs-site tests

Add or extend these tests, and the regeneration recipe below, only when the project's instructions or the request cover docs tooling. Otherwise propose them to the owner as an ID'd action, and meanwhile run the equivalent checks directly: the link crawl, the wireframe linter, and a request for `wireframe.css` that must return 200 with `text/css`.

The tests run in the project's own test runner, reach the docs server and assert:

- The index body starts with an H1. The set of local `.html` links in the index equals the set of `.html` files under the docs tree, and the same for `.md` files. Leave out the index itself. Links to other origins and links meant for reading in the repository host, such as `../references/*.md` outside the served tree, are excluded on purpose.
- Every generated diagram returns 200 and contains the diagram tool's SVG marker (for Archify, `svg[aria-labelledby="archify-diagram-title archify-diagram-description"]`). Tell diagrams and wireframes apart by path (`ux-flows/wireframes/`).
- Every wireframe returns 200, has a non-empty `h1` and links `wireframe.css`; the stylesheet returns 200 as `text/css`.
- Every Markdown page returns 200 as `text/html; charset=utf-8`, its body starts with an H1, it has a non-empty `<title>`, and its text does not contain `created_on:`.
- Encoded traversal paths that name real files outside the tree (for example `..%2fpackage.json` when the docs directory's parent holds one, and `ux-flows/..%2f..%2findex.md`) return 404; a malformed escape (`%E0%A4%A`) returns 400 or 404, since a proxy in front may answer 400; a missing page returns 404. Against the template server, HEAD returns 200 with an empty body and POST returns 405 with `Allow: GET, HEAD`.

When the site's server renders Markdown in the browser (see [Serving](#serving)), start the template server, copied into the project, on a spare loopback port inside the test and run every assertion against it.

Run these tests, or the direct checks, whenever you add a new kind of page (the first wireframe, Markdown proposal or research note): an assertion written for the old kinds, such as "every page is a diagram", fails on the new one. Confirm each new test fails without its fix (remove the fix, watch it fail, restore it, watch it pass).

## Diagram regeneration recipe

[Diagrams](diagrams.md#regeneration-recipe) owns the recipe's requirements and script. Under the docs-tooling condition in [Docs-site tests](#docs-site-tests), add it, or extend the project's existing diagram recipe, in the change that adds the first flow spec; otherwise include it in the proposed action and finalize changed specs directly as [diagrams](diagrams.md#running-archify) describes. In POSIX `sh`, guard the empty glob with `[ -e "$f" ] || continue` as the loop's first line, in place of bash's `shopt -s nullglob`.

Cover the recipe with a test that replaces the diagram tool with a stub: an empty spec folder runs nothing and passes, receipt files are skipped, and a failing spec makes the recipe exit nonzero. Confirm the empty-folder test fails with the guard removed.

## Wireframe lint

```bash
bun <skill>/scripts/lint-wireframes.ts --site-root <docs> <docs>/ux-flows/wireframes
```

Lint the whole directory, `index.html` and `patterns.html` included, and lint it again after any change to `wireframe.css`: a stylesheet change can break pages you did not touch. Flags, output, exit codes, the expected `nav-ticket` warning and the rules are in [design language](design-language.md#checking-a-page).

## Link crawl

```bash
bun --use-system-ca <skill>/scripts/crawl-site.ts <origin>/ --root-dir <docs>
```

- Any run that wrote docs pages, review-only runs included, runs the crawl before reporting.
- Start at the URL that serves the docs index. `--root-dir` names the directory that URL's folder maps to; every `.html` and `.md` file under it must then be reached from some crawled page.
- `--ignore <regex>` (repeatable) is matched against each resolved absolute link URL. Add it only when the index links files meant for reading on the repository host, outside the served tree: from an index at the site root, `../references/x.md` resolves to `<origin>/references/x.md`, so pass `--ignore '/references/'`.
- Run as `bun --use-system-ca` when the local site uses a locally trusted certificate (a dev proxy's local certificate authority); pass `--insecure` as a fallback. `start page unreachable` means the start URL itself failed: the server is down, the URL is wrong, or the certificate was rejected.
- `--external` also requests links to other origins; without it the summary counts them as not checked. `--max-pages <n>` caps the crawl (default 2000); `--json` prints the full result.
- The crawler follows only links in server-rendered HTML; crawl the template server when the site's server renders Markdown in the browser.
- Exit 0 means clean, 1 means anything broken, missing or unlinked (or an unreachable start page), 2 means bad usage.

| Line | Meaning | Fix |
| --- | --- | --- |
| `<status> <url>`, then `linked from <page>` | The request failed: an HTTP status of 400 or more, or a network error code | Link the page instead of a folder (`wireframes/index.html`, not `wireframes/`); correct the path; render the missing file or write "not generated yet" |
| `missing anchor <url>#<id>` | The target page has no element with that `id` (or `a name`); only fragments that start with a letter are checked | Add the missing id to the target, or correct the fragment |
| `unlinked file <path>` | A file under `--root-dir` that no crawled page links | Link it from the docs index, or delete it when obsolete |
| `skipped <url>` | The link matched `--ignore` | None |

## Visual evidence

- Before changing an existing page (the stylesheet, the legend, a mockup, the layout), capture screenshots of every page the change affects. Afterwards capture the same pages at comparable viewport sizes and scroll positions: at least one wide and one narrow viewport (for example 1440 and 800 CSS pixels), plus scrolled states for sticky elements and section-link landings.
- Capture a full-page screenshot of every new page.
- Open and inspect every screenshot before reporting. Look for overflow, overlap, clipped text, callouts that do not match their captions, and unstyled pages (a stylesheet that did not load).
- Keep the screenshots in `<state>/shots/<unit-key>/` and never commit them.
- State which pages were visually inspected and which only passed automated checks. When you cannot inspect every page, spot-check at least one page per flow group.

## Privacy

- Keep private hostnames, scratch URLs (loopback addresses with ports, dev-proxy hostnames), local absolute paths and credentials out of tracked files.
- Link pages relative to each other inside the docs tree and never write a preview origin into a file. Derive preview URLs from the running service at report time: the template server prints `serving <dir> at <url>`, and a dev runner reports its routes.
- Scan the docs tree before committing, generated diagrams included, for example `rg -n '127\.0\.0\.1|localhost|/Users/|/home/|/private/' <docs>/ux-flows` plus the project's private-domain list, and review each hit; run it again before the Phase 9 report, which requires every hit reviewed. In a public project also search for the tracker's host and ticket references (`#<number>`), since committed artifacts carry none (SKILL.md "ID conventions"). `rg` skips ignored files, so a hit in a delivery receipt means its ignore rule is missing. `git ls-files '<docs>/ux-flows/*.delivery.json'` must print nothing.

## Reporting

Give the owner:

- Clickable preview URLs, read from the running server, for the docs index, the wireframe index and each new or changed page.
- The direct URL patterns, for example `<origin>/ux-flows/wireframes/<key>.html` and `<origin>/ux-flows/<key>-proposed.html` when `<docs>` is served at the site root.
- The file layout of `<docs>/ux-flows/` as a short tree.
- How to open pages offline: opening the HTML files from disk works for relative links between pages and for the standalone diagrams, but root links such as the wireframe index's `/` back link fail, and Markdown files open unrendered.
- Which server serves the site and the exact command that restarts it: the dev runner's start command or recipe, or the template server command with its `DOCS_DIR` and `PORT`.
- The verification run: the lint, crawl and docs-site test summary lines (or the direct checks run in their place), the privacy scan and delivery-receipt check results, and the visual-inspection coverage statement.
