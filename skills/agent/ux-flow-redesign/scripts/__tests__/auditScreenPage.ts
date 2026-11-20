/** A page with one known instance of each defect audit-screen.ts reports, plus controls that must pass. */
export const AUDIT_FIXTURE_PAGE = `<!doctype html>
<html>
<head>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font: 16px sans-serif; background: #fff; color: #111; }
  .faint { color: #aaa; }
  .field { border: 1px solid #767676; background: transparent; color: inherit; height: 32px; }
  .row button, #wide-a, #wide-b { border: 1px solid #333; background: #fff; color: #111; }
  .tiny { display: inline-block; width: 16px; height: 16px; }
  .wide { width: 2000px; height: 10px; }
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
  <div class="dev-overlay"><p class="faint">Overlay text</p></div>
  <div class="wide" id="wide"></div>
</body>
</html>`;
