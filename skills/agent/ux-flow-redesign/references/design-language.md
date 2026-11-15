# Wireframe design language

- [Purpose and limits](#purpose-and-limits)
- [Files](#files)
- [Tokens](#tokens)
- [Layout](#layout)
- [Page anatomy](#page-anatomy)
- [The sticky key](#the-sticky-key)
- [Legend](#legend)
- [Steps and callouts](#steps-and-callouts)
- [Vocabulary](#vocabulary)
- [Menus](#menus)
- [Bars](#bars)
- [The index page](#the-index-page)
- [The pattern page](#the-pattern-page)
- [Drawing errors and proposal errors](#drawing-errors-and-proposal-errors)
- [Checking a page](#checking-a-page)

Examples below use an invented reporting app (reports, exports, documents, folders); they are illustrative only.

## Purpose and limits

A wireframe page is low-fidelity static HTML that lets the owner understand a proposed flow step by step. It illustrates the written proposal; it does not specify pixels.

- Use static HTML plus the shared stylesheet only: no JavaScript, no external resources (scripts, fonts, stylesheets or CDNs from elsewhere), no images. Draw icons and controls with text and Unicode glyphs (☑ ☐ ◉ ○ ⋯ ▾ ›).
- Depict the proposal faithfully. Do not invent steps, features or controls it does not describe; when drawing exposes a gap or a contradiction, handle it under [Drawing errors and proposal errors](#drawing-errors-and-proposal-errors).
- Use invented, illustrative names and numbers. No real people, customer data, private hostnames, local file paths or loopback addresses.
- Under the TLDR, every flow page carries this disclaimer verbatim:

  ```html
  <p class="muted small">Low-fidelity wireframe. Layout, names and numbers are illustrative; the redesign ticket's acceptance criteria are authoritative.</p>
  ```

- The ticket's acceptance criteria are authoritative. A page that disagrees with them is wrong.

## Files

- `wireframes/wireframe.css` is the one shared stylesheet, created from [wireframe.css](../assets/templates/wireframe.css) by the scaffolder. Every page in the folder links it with `<link rel="stylesheet" href="wireframe.css">`: each flow page, `index.html` and `patterns.html`. Never paste its rules into a page; an old pasted block marked `/* wireframe-css … */` fails the linter (`copied-block`): delete it and link the file.
- Page-specific rules go in the page's own short `<style>` after the link. A rule that a second page needs belongs in the stylesheet, because page-local copies drift apart.
- Never redefine the stylesheet's top-level `:root` tokens in a page (`token-redefined`). Change a token in the stylesheet, which changes every page, then lint the whole folder and screenshot every page.
- `--key-h` is deliberately not a top-level token: it is set only inside media queries, so a page whose key band differs may set its own value (the pattern page does). Keep it out of the top-level `:root` block.
- The legend swatches repeat four hard-coded colors from the stylesheet: toast `#1f2328`, popover border `#9aa3af`, backdrop `#2b30381f`, panel `#fafbfc`. Changing one in the stylesheet means changing the swatch on every page.
- Serve the pages as [publishing](publishing.md) describes; it owns the server requirements, including the stylesheet's content type.

## Tokens

The stylesheet's top-level `:root` defines:

| Token | Value | Used for |
| --- | --- | --- |
| `--font` | `"Maple Mono Normal NF", "Maple Mono Normal", "Maple Mono NF", "Maple Mono", ui-monospace, monospace` | every font family |
| `--ink` | `#1f2328` | body text, bold labels |
| `--mute` | `#6b7280` | secondary text, field labels, legend text, `.fixes` lines |
| `--line` | `#c9ced6` | borders and dividers |
| `--bg` | `#f6f7f9` | page background |
| `--card` | `#fff` | header, key band, windows, cards |
| `--acc` | `#2563eb` | links, primary buttons, row-cursor bar, `.open` outline, edited fields, accent chips and banners |
| `--accbg` | `#e8efff` | selected rows, current navigation item, info banners, accent chips |
| `--warn`, `--warnbg` | `#9a4a00`, `#fff4e0` | warning chips and banners (the default `.banner`), conflict cards |
| `--bad`, `--badbg` | `#b91c1c`, `#fdecec` | destructive buttons and menu items, invalid fields, error chips and banners, `del` |
| `--ok`, `--okbg` | `#15803d`, `#e3f5e9` | just-changed tint, success chips and banners, `ins` |
| `--note` | `#e11d48` | numbered callout markers |

Font rules:

- Maple Mono comes from local installs; there is no `@font-face` and no web-font download. Without it installed, the fallbacks render, so measure and screenshot on a machine that has it, or say in the report that you did not.
- Every font declaration uses `var(--font)`: the body (`font: 14px/1.45 var(--font)`), `kbd` (`font: 11px var(--font)`), and page rules such as the pattern page's rule IDs (`font: 600 11px var(--font)`) and reference-table cells (`font: 12px/1.45 var(--font)`). `code`, `pre`, `samp`, `button`, `input`, `select` and `textarea` inherit through `font-family: inherit`.
- Keep sizes and weights as declared; change the family only through the token. The linter rejects any `font-family` other than `var(--font)` and any `font` shorthand that does not end with `var(--font)` (`font-family`); CSS-wide keywords such as `inherit` pass.

Monospace text is wider than proportional text, so legend rows, menus and table cells take more room. After changing the font, the legend, or the pattern page's contents nav, re-measure the key band:

1. Serve the page and open it in a browser at about 1440, 1100 and 800 px wide.
2. At each width read `document.querySelector('.key').offsetHeight`.
3. Convert to rem at 16 px per rem (the stylesheet leaves the root size alone) and round up to the next 0.1 rem.
4. Set `--key-h` for that breakpoint:

| Width | Flow pages set it in the stylesheet | Pattern page sets it in its own `<style>` | Template values (flow / pattern) |
| --- | --- | --- | --- |
| above 1400 px (measure at 1440) | the fallback in `html { scroll-padding-top: calc(var(--key-h, 3.5rem) + 10px) }` | top-level `:root { --key-h }` | 3.5rem / 6.1rem |
| 901–1400 px (measure at 1100) | `@media (max-width: 1400px) { :root { --key-h } }` | same media query | 5rem / 7.5rem |
| 900 px and below (measure at 800) | `@media (max-width: 900px) { :root { --key-h } }` | same media query | 2.1rem / 3.4rem |

The template values are starting points; measure your own pages.

## Layout

- Pages use the full window width. Never put `max-width` on `main` (`layout-cap`) or fixed widths on `.win`: a capped layout leaves a large empty gap on wide screens.
- `.step` is a two-column grid, `minmax(0, 1fr) clamp(15rem, 40%, 48rem)`: the mockup takes the extra width and the caption stays between 15 and 48 rem, readable at any width. At 900 px and below it becomes one column with the caption under the mockup.
- The pattern page's `.step.pat` uses `minmax(0, 1fr) clamp(18rem, 54%, 56rem)` because rule text is longer. Its mockup sticks under the key band (`top: calc(var(--key-h, 3.5rem) + 12px)`) and stops sticking at 900 px and below.
- Text blocks keep a 72 rem reading cap: `header.page p`, the pattern page's `.decide` box and `.full > p`. Cap paragraphs, never the page.
- A step holds exactly one mockup element and one `.cap` as direct children; a second mockup wraps into the caption's column. Wrap two windows (for example before and after) in one `<div>`.

## Page anatomy

A flow page, from [flow-wireframe.html](../assets/templates/flow-wireframe.html), in this order:

1. `<title>` "*Flow title* · proposed flow wireframe", then the stylesheet link.
2. `header.page` containing:
   - `nav.top` with these links in this order: `← All flows` (`index.html`), `Today's flow diagram` (`../<key>-current.html`), `Proposed flow diagram` (`../<key>-proposed.html`), `Written proposal` (`../proposals/<key>.md`), then the ticket. Before filing it is `<span class="muted">Redesign ticket: not filed yet</span>`, which the scaffolder writes and which leaves only the `nav-ticket` warning. After filing (see [proposals and tickets](proposals-and-tickets.md#filing)), replace it with `<a href="<ticket>">Redesign ticket <label></a>`, where `<ticket>` is the tracker URL or the Markdown ticket's path `../tickets/<id>.md`;
   - one `h1`, the flow title;
   - `<p><b>TLDR:</b> …</p>`, one sentence on what the new flow does differently;
   - the disclaimer line.
3. The `div.key` band immediately after the header.
4. `main` with 4–8 `section.step` blocks, one per target step of the proposal, in the proposal's order. Give each step a stable kebab-case `id` so proposals and tickets can link to it.
5. A final `section.changes` grid inside `main`: one `div` each for `Removed`, `New`, `Kept` and `Backend work`, plus `Merged` or `Changed` when they apply, each with an `h3` and 3–6 short bullets.

Name the file `<key>.html`: the linter derives the flow key from the file name to check the navigation links.

## The sticky key

```html
<div class="key"><div>
<div class="legend">…</div>
</div></div>
```

- CSS only, no JavaScript. `.key` is `position: sticky; top: 0` with `container-type: scroll-state`, and `@container scroll-state(stuck: top)` adds a shadow to `.key > div` once the band is pinned. Keep the inner `div`: a container query styles only the container's descendants. Browsers without scroll-state queries still pin the band, without the shadow; do not emulate the shadow with script.
- Place the band immediately after `header.page`. `header.page:has(+ .key)` drops the header's bottom border so the band reads as part of the header; anything in between brings back a double line.
- `html { scroll-padding-top }` comes from `--key-h`, so links to a step or to `#conflicts` land below the band instead of under it. A stale `--key-h` hides the top of the target; re-measure it as described under [Tokens](#tokens).
- At 900 px and below each row (legend, contents nav) stays on one line and scrolls sideways, so the band is one row tall.
- On every page with steps, the linter requires the legend inside `.key` and rejects a legend outside it (`legend`).

## Legend

Copy this block verbatim into every page with mockups (each flow page and the pattern page):

```html
<div class="legend"><b style="color:var(--ink)">How to read:</b>
<span><i class="k" style="background:#1f2328;border-color:#1f2328"></i>Toast: passing status message in a corner, links only, no decisions</span>
<span><i class="k" style="background:#fff;border-color:#9aa3af;box-shadow:0 2px 6px #0003"></i>Popover or menu: opens from the outlined control its arrow points at</span>
<span><i class="k" style="background:#fafbfc;box-shadow:inset 3px 0 var(--line)"></i>Panel: docked beside the table, stays open</span>
<span><i class="k" style="background:#2b30381f"></i>Dimmed backdrop: dialog that blocks the page</span>
<span><i class="k" style="background:var(--accbg)"></i>Selected rows</span>
<span><i class="k" style="background:var(--okbg)"></i>Just changed</span>
<span><i class="k" style="background:#fff;box-shadow:inset 3px 0 var(--acc)"></i>Row cursor</span>
<span><span class="n">1</span>Callout, explained on the right</span></div>
```

- Every convention a mockup uses needs its entry. The linter (`legend-entry`) fails a page whose mockups use one without legend text that names it: `.toast` needs "toast"; `.popover` or `.menu` needs "popover" or "menu"; `.dock` needs "panel" or "dock"; `.scrim` needs "backdrop" or "dialog"; `.sel` needs "selected"; `.flash` or `.chg` needs "changed"; `tr.focus` needs "cursor"; `.n` callouts need a `.n` marker in the legend.
- Keep all eight entries on every flow page, even where a page uses fewer, so the band looks the same everywhere and the stylesheet's `--key-h` stays correct.
- Before using any new visual convention (a tint, line style or glyph that carries a meaning), add a swatch entry for it to the legend of every page that uses it. When that changes a page's band height, measure it and set that page's `--key-h` in its own `<style>`. The linter knows only the built-in conventions and cannot catch a new one.

## Steps and callouts

```html
<section class="step" id="pick-reports">
<div class="win">
<div class="bar"><b>Reports › Quarterly</b></div>
<div class="app">
<div class="side"><div>Inbox</div><div class="on">Quarterly</div></div>
<div class="work">…<span class="n">1</span>…</div>
</div>
<div class="toastrow"><div class="toast">Exported 12 reports to Finance <a>Undo</a><a>Show</a></div><span class="n">2</span></div>
</div>
<div class="cap"><h2>1. Pick reports</h2>
<p>Selecting works as today; the export entry point is new.</p>
<ol><li><span class="n">1</span> …</li>
<li><span class="n">2</span> …</li></ol>
<p class="fixes">Fixes export-03, export-07 · Backend: export preview returns per-file sizes</p></div>
</section>
```

The mockup:

- `.win` is the window frame; `.bar` is its title strip with the location in bold.
- Inside it, `.app` is the screen grid: `.side` navigation (one `div` per item, the current one `.on`) and the `.work` area (`.tb` toolbar, `table.t`, bars). `.app.dock3` adds a 270 px docked panel (`.dock`) as a third column; `.app.full` drops the navigation.
- A blocking dialog replaces `.app` with `.scrim` holding the `.dlg`. Toasts go in a `.toastrow` after `.app`, inside `.win`.
- For a product that is not a web app, draw the frame it uses and keep the same classes and legend meanings.
- In `table.t`, set column widths with `style="width:N%"` on `th`; cells ellipsize. End a long list with `<tr class="dim"><td colspan="…">… 240 more rows</td></tr>`.

The caption (`.cap`):

- `h2` reads "N. Step name", where N is the step's position on the page.
- An optional `<p>` summary follows.
- An `ol` follows, one `<li>` per callout, each starting with `<span class="n">k</span>`. Numbering restarts at 1 in each step. Place the same marker in the mockup next to the thing it explains. Every number in the mockup has exactly one explanation in the caption, and every explanation has a marker in the mockup (`callout`).
- `p.fixes` ends the caption: "Fixes" with the finding tickets this step resolves, then the backend work it needs.

Each step must make sense alone, because owners screenshot and question single steps:

- Say what stays the same as well as what changes; never rely on a later step to explain an earlier one.
- When a step adds an entry point, say that it supplements the existing ones and name them, for example "Export… in the footer is one more way to open the report menu; right-click and the row ⋯ still open it."

## Vocabulary

The legend's conventions:

| Convention | Meaning | Markup | Rules |
| --- | --- | --- | --- |
| Toast | passing status after something finished | `.toastrow > .toast`: a dark inverse box in the window's bottom corner; one sentence, then `<a>` links | Links only (for example Undo, Show). Never a decision: no `.btn`, `button`, `input` or `select` (`toast-action`). Never a list someone must keep, such as failure details, because it disappears. Never covering a primary action. |
| Popover or menu | a small surface opened from a control | `.popover` (plus `.menu` for menus), a light outlined card with `<i class="caret-dn">` when it sits above its trigger or `<i class="caret-up">` when below, and a `.from` line naming its opener, for example "Opened from Finance ▾ in the footer" | Draw the trigger in the same `.win` with the `.open` outline (`popover-trigger`). Place the popover next to its trigger without covering it. Position the caret with inline `left` or `right` so it points at the trigger's center: offset = trigger center − popover edge − 6 px (half the 12 px caret). Measure both rectangles in a browser; do not guess. |
| Docked panel | a panel beside the table that stays open while people keep working | `.app.dock3` with a `.dock` column: `h3`, `.fld` rows, `.ft` footer | Footer: Cancel, then the effect-named primary button. |
| Dimmed backdrop | a dialog that blocks the page | `.scrim` holding `.dlg` with `.hd` (an `h3`), `.body` and `.ft` | Use only for blocking dialogs, never for panels or popovers. |
| Selected rows | rows in the selection | `tr.sel` | |
| Just changed | rows or cells a write just changed | `tr.flash` for a row, `td.chg` for a cell | Only after a write lands; never for selection. |
| Row cursor | the row with keyboard focus | `tr.focus`, usually `tr.sel.focus` | One per table. |
| Callout | a numbered note | `<span class="n">k</span>` | Explained once in the step's caption. |

Classes without legend entries; their look explains itself:

| Class | Draws |
| --- | --- |
| `.selbar` | a bar under the table for the selection summary and actions; a placeholder until the pattern reference decides its content (see [Bars](#bars)) |
| `.tb` | a toolbar row above the table: search field, filters, toolbar actions |
| `.btn`, `.btn.pri`, `.btn.danger`, `.btn.off` | a button; the primary action; a destructive action; a disabled action, with its reason shown beside it |
| `.chip`, `.chip.warn`, `.chip.bad`, `.chip.ok`, `.chip.acc` | a pill for a status or count, or a compact dropdown trigger (`<span class="chip acc">Finance ▾</span>`) |
| `.in`, `.in.mixed`, `.in.changed`, `.in.err` | a text field; differing values across the selection ("Mixed · 4 values"); an edited, unsaved value; an invalid value |
| `.fld` | a label-and-control row with exactly two children: the label `span` and one control `span`. Put several controls and any callout inside that second `span`; extra children wrap onto new grid rows and stretch |
| `.tabs > span`, `span.on` | tabs; the current tab |
| `.banner`, `.banner.bad`, `.banner.ok`, `.banner.info` | an inline message: warning (the default), error, success, information |
| `<del>old</del> <ins>new</ins>` | a before → after value in a review |
| `kbd` | a key or accelerator |
| `.box` | a bordered group inside a surface |
| `.muted`, `.small`, `.row`, `.sp` | secondary text; 12 px text; a flex row with gaps; a spacer that pushes what follows to the right |
| `.toastrow` | the right-aligned row that holds a toast |
| `.dlg .hd`, `.dlg .body`, `.dlg .ft` | a dialog's title, body and action footer |

When one of these carries a meaning a reader cannot infer from the drawing, explain it with a callout or add a legend entry.

## Menus

```html
<div class="popover menu"><span class="caret-up" style="right:38px"></span>
<div class="from">Right-click, ⋯ or the context-menu key on a selected row</div>
<div class="row"><b>3 reports</b></div>
<div class="lbl">Open</div>
<div class="row">Open<span class="sp"></span><kbd>Enter</kbd></div>
<div class="row">Open in new tab</div>
<div class="lbl">Share</div>
<div class="row">Export…<span class="sp"></span><kbd>E</kbd></div>
<div class="row muted">Email…<span class="sp"></span>No mail account set up</div>
<div class="sep"></div>
<div class="row" style="color:var(--bad)">Delete 3 reports…</div>
</div>
```

- The first row is the target header: what the menu acts on (a count and kind, or the item's name).
- Then groups. A `.lbl` heading labels two or more items; a lone item joins its closest related group instead of getting a heading. The linter counts the menu's direct children between a `.lbl` and the next `.lbl` or `.sep` (`menu-heading`), so keep items as direct children of `.menu`.
- Only the destructive last item stands alone, after a `.sep` and without a heading, in `color: var(--bad)`.
- When a context hides items and leaves a group with one item, that item drops its heading and stays in place after a separator.
- Disabled items stay visible as `.row.muted`, with the reason after a `.sp`.
- Accelerators sit right-aligned: `.sp`, then `kbd`. Items that ask for more input end with "…".
- Keep the same groups in the same order at every selection size; hide or disable items instead of reordering.
- A menu is a popover: it needs its caret, its `.from` line and its `.open` trigger in the same window.

## Bars

- Draw the selection summary and the command or shortcut bar exactly as the pattern reference decides (its section 2.2, the `BAR-n` rules): position, content and order of items, identically on every page.
- The `.selbar` in the flow template is a placeholder for those rules, not a decision. When the reference moves the summary into a footer or removes the in-table bar, draw that instead.
- Parallel designers copy the exemplar page, so an exemplar that contradicts the reference spreads its contradiction to every page copied from it. Check the exemplar's bars, menus and surfaces rule by rule against the reference before handing it out.
- When anyone reports an inconsistency, count how many pages draw each variant (search the folder for the classes and labels) before answering, and record it as a conflict on the index.

## The index page

`wireframes/index.html`, from [wireframes-index.html](../assets/templates/wireframes-index.html), links the stylesheet but has no steps, so it needs no legend or key band.

- Header: `nav.top` with `← Documentation index` (`/`), the `h1`, and one paragraph saying there is one page per flow and that the redesign tickets are authoritative.
- `h2` "Shared patterns" with a paragraph linking `patterns.html` and `../patterns.md`.
- `<h2 id="conflicts">Conflicts to settle before building</h2>` with a `.card.warn` list of every cross-flow disagreement found while drawing, one item each: `<li><b>Topic.</b> what one flow does (link to its page or step); what the other does (link).</li>`. An entry leaves the list when the pattern reference decides it; with none open, keep the heading and write "None open." Every "Open conflict" banner links `index.html#conflicts`, so never rename the id.
- One `h2` per flow group, each followed by a `.grid` of cards:

  ```html
  <div class="card"><h3><a href="<key>.html">Flow title</a></h3><p>One-sentence TLDR</p><div class="links"><a href="../<key>-proposed.html">Diagram</a><a href="../proposals/<key>.md">Proposal</a><a href="<ticket URL>">Ticket label</a></div></div>
  ```

  The scaffolder inserts each card with a `{{TLDR_ONE_SENTENCE}}` placeholder; replace it with the flow page's TLDR. Without a filed ticket it omits the ticket link; add it after filing, with the same target as the page's nav.
- Keep the marker comment `<!-- flow cards: scaffold-flow.ts inserts new cards above this line -->` exactly as written. The scaffolder inserts every new card above it and fails when it is missing. There is one marker, so move a card into another group's grid by hand.

## The pattern page

`wireframes/patterns.html`, from [patterns.html](../assets/templates/patterns.html), is the visual condensation of `patterns.md`; [pattern reference](pattern-reference.md) owns its content.

- Header: `nav.top` (`← All flows`, `Full text of the reference`), `h1` "Shared UX patterns", a short introduction, the `.decide` box (`id="product-decisions"`) with an `h2` "Product decisions", a status sentence and one item per decision (`<li><b>O1 Question. Decided:</b> summary</li>`, or `Recommended:` until the owner decides), then a disclaimer naming the reference revision it condenses.
- Key band: the legend plus `nav.toc`, with `<b>Patterns:</b>` and `<b>Tables:</b>` groups of links to section ids. The linter checks that each fragment exists (`link`).
- One `section.step.pat` per canonical pattern in section 2 of `patterns.md`, in the same order and with the same rule IDs. The mockup is on the left; the `.cap` on the right has an `h2` "N. Pattern name", a `<p>` saying when to use the pattern, `ol.rules` whose items start with the bold rule ID (`<li><b>MENU-2</b> <span class="n">2</span> rule text</li>`, with the callout only when the rule points at the mockup), and a `.fixes` line with backend, accessibility and contract notes.
- Keep each mockup in sync with its rule text: every item a rule lists appears in the mockup, and the mockup shows nothing the rules contradict.
- Tables go in `section.full` blocks, each with an `h2.sec`, a `p.small.muted` introduction and a `table.t.ref` with a `colgroup` for widths. Unlike mockup tables, `.t.ref` cells wrap. The keyboard map (`id="keyboard-map"`) has columns Key, Scope, Action and Owning flow. The decision log (`id="decision-log"`) has ID, Topic, Decision and Rules, with `tr.grp` rows reading "*dimension* · N decisions". Contract changes (`id="contracts"`) has ID, From and Change.
- Its key band also holds the contents nav, so the page sets larger `--key-h` values in its own `<style>`. Re-measure after changing the legend, the contents nav or the font.

## Drawing errors and proposal errors

Classify every problem before fixing it:

- **Drawing error:** the page does not show what the proposal or the reference says, for example a popover floating away from its trigger, a convention missing from the legend, or a menu missing an item the rule lists. Fix the drawing.
- **Proposal error:** the drawing faithfully shows a proposal that conflicts with the reference or with another flow, for example a decision inside a toast, or a bar the reference removed. Keep the drawing, because redrawing it alone would make the page diverge from its proposal. Instead:
  1. Add an "Open conflict" banner at the top of that step's caption, outside the mockup so nobody mistakes it for product UI:

     ```html
     <div class="banner">Open conflict: this proposal puts the export target inside a toast; Reports and Archive open the shared export panel instead. <a href="index.html#conflicts">See conflicts</a></div>
     ```

  2. Add or extend the entry in the index's conflicts list.
  3. Raise it for the pattern reference as a decision or a proposed exception. Phase 8 redraws the page once it is decided.

After finding one instance of any mistake, search every page for the same mistake and fix or classify each instance before linting again.

## Checking a page

Run the linter over the whole folder, not one page: the check for several stylesheet copies and cross-page fragment links need every page. From the project root, where `<skill>` is this skill's directory:

```bash
bun <skill>/scripts/lint-wireframes.ts --site-root <docs> <docs>/ux-flows/wireframes
```

It prints `file:line: severity rule: message` and exits 1 on any error. `--site-root` is the directory the server maps `/` to; without it, root-relative links such as the index's `/` go unchecked. `--json` gives machine-readable output; `--stylesheet <name>` is needed only when the shared stylesheet has another name. Fix every error. The `nav-ticket` warning is expected only while the flow's ticket is not filed; once it is, the nav links the ticket (see [Page anatomy](#page-anatomy)) and the warning must be gone.

| Rule | Fails when |
| --- | --- |
| `stylesheet` | a page does not link the shared stylesheet with `<link rel="stylesheet" href="wireframe.css">`; a warning when pages link more than one copy of it |
| `font-token` | the linked stylesheet's top-level `:root` lacks `--font` |
| `font-family` | a `font-family` other than `var(--font)`, or a `font` shorthand not ending in `var(--font)`, appears in the stylesheet, a page `<style>` or a `style` attribute |
| `layout-cap` | a `main` rule sets `max-width` to anything but `none` |
| `token-redefined` | a page `<style>` or `style` attribute sets a property that the stylesheet's top-level `:root` defines |
| `copied-block` | a page `<style>` still holds a pasted block marked `/* wireframe-css` |
| `step` | a `.step` lacks a mockup child or a `.cap` child containing an `h2` |
| `callout` | a mockup number has no explanation in its caption, a caption explains a number the mockup does not show, or a caption explains a number twice |
| `legend` | a page with steps has no `.legend` inside `.key`, or has a `.legend` outside it |
| `legend-entry` | the mockups use a built-in convention or numbered callouts that the legend does not explain |
| `menu-heading` | a `.lbl` in a `.menu` labels fewer than two items |
| `popover-trigger` | a mockup popover or menu with a caret has no `.open` element in its window |
| `toast-action` | a `.toast` contains a `.btn`, `button`, `input` or `select` |
| `nav` | a page with steps, other than `index.html` and `patterns.html`, lacks `nav.top` or its links to `index.html`, `<key>-current.html`, `<key>-proposed.html` and `proposals/<key>.md` |
| `nav-ticket` (warning) | `nav.top` has no link that starts with `http://` or `https://` or contains `tickets/` |
| `link` | a relative `href` or `src` on `a`, `link`, `img` or `script` points at a missing file, at a directory without `index.html` or `index.md`, or at a `#fragment` with no matching id on the page or in the target HTML page |
| `h1` | a page has other than exactly one `h1` |
| `duplicate-id` | an id appears twice on a page |
| `placeholder` | a `{{PLACEHOLDER}}` is left unfilled |

The linter does not catch scripts, images, external resources, private hostnames, local paths or real names. Search for them, for example `rg -n -e '<script' -e '<img' -e 'localhost' -e '127\.0\.0\.1' <docs>/ux-flows/wireframes`, and look for home-directory paths and private hostnames too.

Then check what the owner will see:

1. Serve the docs (see [publishing](publishing.md)) and confirm the page returns HTTP 200.
2. With a browser automation tool, take a full-page screenshot at 1440 px wide and another at 800 px wide. Open both and read them.
3. Fix horizontal overflow, overlapping elements, clipped text, callout markers that do not sit next to what their captions describe, popovers away from or covering their triggers, and toasts covering a primary action.
4. Scroll down one screen and confirm the key band stays pinned with its shadow, then follow one step link and confirm the step's heading lands below the band.
5. Confirm positions such as caret offsets and popover placement with element-cropped screenshots of the window; a full-page screenshot is too small to judge a few pixels.

Overlays injected by a dev server or the browser tool are not page content. After a stylesheet change, repeat the linter and the visual check for every page.
