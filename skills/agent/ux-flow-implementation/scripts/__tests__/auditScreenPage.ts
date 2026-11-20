/** A page with one known instance of each defect audit-screen.ts reports, plus controls that must pass. */
export const AUDIT_FIXTURE_PAGE = `<!doctype html>
<html>
<head>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font: 16px sans-serif; background: #fff; color: #111; }
  /* Slow theme transitions: a measurement taken right after a color scheme switch reads the colors mid-way. */
  body, .faint, .field { transition: color 1.5s linear, background-color 1.5s linear, border-color 1.5s linear; }
  .spinner { width: 4px; height: 4px; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .faint { color: #aaa; }
  .field { border: 1px solid #767676; background: transparent; color: inherit; height: 32px; }
  .row button, #wide-a, #wide-b { border: 1px solid #333; background: #fff; color: #111; }
  .tiny { display: inline-block; width: 16px; height: 16px; }
  .wide { width: 2000px; height: 10px; }
  .apart { margin-top: 24px; }
  .masked::before { content: ""; display: inline-block; width: 12px; height: 12px; background-image: linear-gradient(currentColor, currentColor); }
  @media (prefers-color-scheme: dark) {
    body { background: oklch(0.2 0 0); color: #eee; }
    .faint { color: #ccc; }
    .field { border-color: rgb(255 255 255 / 0.08); }
  }
</style>
</head>
<body>
  <p id="ok">Readable text</p>
  <p id="faint" class="faint">Faint text</p>
  <input id="name" class="field" aria-label="Name">
  <div class="row"><button id="tall" style="height: 40px">Save</button><button id="short" style="height: 28px">Cancel</button></div>
  <div class="stack"><button id="wide-a" style="display: block; width: 200px">First</button><button id="wide-b" style="display: block; width: 120px">Second</button></div>
  <div><a href="#a" class="tiny" id="tiny-a">a</a><a href="#b" class="tiny" id="tiny-b">b</a></div>
  <p>Inline <a href="#c" id="inline">link</a> in running text.</p>
  <button id="ghost" style="border: 0; background: none; color: inherit">Ghost</button>
  <div class="apart"><button id="close" aria-label="Close" style="border: 0; background: none; color: inherit; width: 32px; height: 32px"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor"/></svg></button></div>
  <div class="apart"><button id="masked" class="masked" style="border: 0; background: none; color: inherit; height: 32px">Copy</button></div>
  <div class="dev-overlay"><p class="faint">Overlay text</p></div>
  <div class="spinner"></div>
  <div class="wide" id="wide"></div>
</body>
</html>`;

/** Heights in CSS px of the pinned-bars page's parts. */
export const PINNED_PAGE = { header: 48, content: 2100, end: 40, footer: 64 } as const;

/**
 * A page taller than two screens with a fixed header (blue), plain content, an end marker (cyan) and a sticky footer
 * (magenta) like a hand-back bar. A full-page capture of the live page paints the footer at its first-viewport
 * position, over the content halfway down.
 */
export const PINNED_BARS_PAGE = `<!doctype html>
<html>
<head>
<style>
  body { margin: 0; padding-top: ${PINNED_PAGE.header}px; background: #fff; }
  header { position: fixed; top: 0; left: 0; right: 0; height: ${PINNED_PAGE.header}px; background: #0000ff; }
  .content { height: ${PINNED_PAGE.content}px; background: #dddddd; }
  .end { height: ${PINNED_PAGE.end}px; background: #00ffff; }
  footer { position: sticky; bottom: 0; height: ${PINNED_PAGE.footer}px; background: #ff00ff; }
</style>
</head>
<body>
  <header></header>
  <div class="content"></div>
  <div class="end"></div>
  <footer></footer>
</body>
</html>`;
