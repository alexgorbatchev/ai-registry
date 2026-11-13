# Importing images and Storybook screenshots

Use this pipeline to place local images, such as screenshots of an implementation, into a Penpot file through the plugin.

## Contents

- [Transport](#transport)
- [Plugin helpers](#plugin-helpers)
- [Storybook screenshots](#storybook-screenshots)
- [Building reference boards](#building-reference-boards)

## Transport

Image bytes cannot travel through tool calls at scale, and `penpot.uploadMediaUrl` fetches from the Penpot server, which cannot reach the local machine. Instead, plugin code fetches from a loopback server in the user's browser:

1. Start [the asset server](../scripts/serve-assets.ts) on the directory that holds the images, as a background process that stays up while plugin code fetches from it: `bun scripts/serve-assets.ts <dir> [port]` from this skill's directory. It serves `<path>.b64` as base64 text and JSON as-is, with CORS and Private Network Access headers.
2. Test one fetch from plugin code with a short timeout. Recent Chrome versions hold a request from an HTTPS page to `127.0.0.1` until the user answers a "local network access" permission prompt; until then the call hangs and the gateway times out. If the server log shows no request, ask the user to allow the prompt in the Penpot tab, then retry.
3. Plugin `fetch` responses expose only `ok`, `status`, `statusText`, `url`, `text()`, and `json()`; there is no `arrayBuffer()` or `blob()`. Fetch the `.b64` variant, decode it, and upload the bytes.

## Plugin helpers

Install these into `storage` once per connected session; reinstall after the plugin reconnects or the user switches files. Set `storage.base` to the server's URL.

```js
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LUT = new Uint8Array(128); for (let i = 0; i < 64; i++) LUT[A.charCodeAt(i)] = i;
storage.base = 'http://127.0.0.1:47831/';
storage.b64 = (s) => {
  s = s.replace(/[^A-Za-z0-9+/]/g, '');
  const n = s.length, out = new Uint8Array(Math.floor(n * 3 / 4)); let o = 0;
  for (let i = 0; i < n; i += 4) {
    const a = LUT[s.charCodeAt(i)], b = LUT[s.charCodeAt(i + 1)];
    const c = i + 2 < n ? LUT[s.charCodeAt(i + 2)] : 0, d = i + 3 < n ? LUT[s.charCodeAt(i + 3)] : 0;
    out[o++] = (a << 2) | (b >> 4);
    if (i + 2 < n) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < n) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
};
storage.getJSON = async (path) => { const r = await fetch(storage.base + path); if (r.status !== 200) throw new Error('fetch ' + r.status + ' ' + path); return r.json(); };
storage.loadImage = async (path, name) => {
  const r = await fetch(storage.base + path + '.b64');
  if (r.status !== 200) throw new Error('fetch ' + r.status + ' ' + path);
  return penpot.uploadMediaData(name, storage.b64(await r.text()), 'image/png');
};
storage.imgs = storage.imgs || {};
```

- Upload in parallel batches of about eight and cap each call at a few dozen images so it finishes within the gateway's call timeout. Keep the returned image data in `storage.imgs` keyed by path, so later calls skip uploaded files and the build step reuses them.
- Apply an upload as a fill: `rect.fills = [{ fillOpacity: 1, fillImage: img }]`, with the rectangle sized to the image's logical size (pixel size divided by the capture scale).
- Re-uploading creates a new media object; check `storage.imgs` before retrying after an interrupted call.
- Keep per-page payloads (story names, image paths, sizes, documentation text) in JSON files under the served directory, and have plugin code fetch them with `storage.getJSON`, so tool calls stay short.

## Storybook screenshots

[The capture script](../scripts/capture-storybook.ts) screenshots every story of a static Storybook build. Build Storybook first, then run it from the project directory so it resolves the project's Playwright:

```bash
bun <skill-dir>/scripts/capture-storybook.ts --static storybook-static --out <dir> \
  --variant dark=theme:dark --variant light=theme:light
```

- Variants take Storybook globals in URL syntax; use the project's global names from its preview configuration. Without `--variant`, the project's initial globals apply.
- Stories render their initial state: `embed=true` disables play functions, which often close overlays or reset state at the end. Stories that force their own globals keep them in every variant.
- Screenshots are cropped to painted content with 16px padding; stories that render nothing visible, and overlays with full-screen backdrops, keep the full page. Output is `<out>/<variant>/<story id>.png`, plus `manifest.json` (id, title, name, importPath, variant, file, logical width and height, in story order) and `failures.json`. Reruns capture only missing files.
- Use `--filter <regex>` on story ids for a trial run before capturing the whole catalog.

## Building reference boards

- Put reference boards in a separate unpublished file connected to the library; see [reusable library structure](reusable-library.md#file-split).
- One page per component with a showcase board (header, then one board per story with a label and the variant images side by side) and a specification board beside it follows the [Pencil layout](pencil-library.md#showcase-and-spec-boards). Fill the specification from the project's own documentation rather than writing descriptions.
- Style annotation text and boards with the library's tokens or assets.
- Export a single story board and the specification board with `export_shape`, and check that image rectangles carry `fillImage`, before building the remaining pages.
