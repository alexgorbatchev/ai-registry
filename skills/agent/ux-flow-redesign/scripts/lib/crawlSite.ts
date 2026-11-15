import { descendants, findAll, parseHtml, type HtmlElement } from "./html";

export interface CrawlOptions {
  /** First page; only URLs on its origin are crawled. */
  start: string;
  /** Local directory the site serves; every .html and .md file under it must be reached. */
  rootDir?: string;
  /** Also request links to other origins. */
  external?: boolean;
  /** Accept self-signed or locally issued TLS certificates. */
  insecure?: boolean;
  /** Regular expressions; matching link URLs are listed as skipped instead of requested. */
  ignore?: RegExp[];
  maxPages?: number;
  concurrency?: number;
  timeoutMs?: number;
}

export interface Problem {
  url: string;
  status: number | string;
  referrers: string[];
}

export interface CrawlResult {
  /** False when the start page itself could not be read; nothing else is reported then. */
  started: boolean;
  pages: number;
  requested: number;
  broken: Problem[];
  missingFragments: Problem[];
  orphans: string[];
  skipped: string[];
  externalUnchecked: number;
}

interface Fetched {
  status: number | string;
  html?: HtmlElement;
}

const LINK_ATTRIBUTES: Record<string, string> = {
  a: "href",
  link: "href",
  img: "src",
  script: "src",
  iframe: "src",
  source: "src",
};
const CHECKABLE_FRAGMENT = /^[A-Za-z][\w\-:.]*$/;

function withoutFragment(url: URL): string {
  const copy = new URL(url);
  copy.hash = "";
  return copy.href;
}

function linksOf(root: HtmlElement, pageUrl: string): URL[] {
  const links: URL[] = [];
  for (const element of descendants(root)) {
    const attribute = LINK_ATTRIBUTES[element.tag];
    const value = attribute ? element.attrs.get(attribute)?.trim() : undefined;
    if (!value || /^(mailto|tel|javascript|data):/i.test(value)) continue;
    try {
      links.push(new URL(value, pageUrl));
    } catch {
      continue;
    }
  }
  return links;
}

function anchorsOf(root: HtmlElement): Set<string> {
  const anchors = new Set<string>();
  for (const element of findAll(
    root,
    (candidate) => candidate.attrs.has("id") || (candidate.tag === "a" && candidate.attrs.has("name")),
  )) {
    anchors.add(element.attrs.get("id") ?? element.attrs.get("name") ?? "");
  }
  return anchors;
}

async function runPool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await work(items[next++]);
    }),
  );
}

/** Crawls a served documentation site and reports broken links, missing fragments and unreached files. */
export async function crawlSite(options: CrawlOptions): Promise<CrawlResult> {
  const start = new URL(options.start);
  const origin = start.origin;
  const maxPages = options.maxPages ?? 2000;
  const timeoutMs = options.timeoutMs ?? 15000;
  const fetched = new Map<string, Fetched>();
  const referrers = new Map<string, Set<string>>();
  const fragments = new Map<string, Set<string>>();
  const skipped = new Set<string>();
  const external = new Set<string>();
  let requested = 0;

  const refer = (url: string, from: string) => {
    if (!referrers.has(url)) referrers.set(url, new Set());
    referrers.get(url)?.add(from);
  };

  const request = async (url: string): Promise<Fetched> => {
    requested++;
    try {
      const init: RequestInit & { tls?: { rejectUnauthorized: boolean } } = {
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      };
      if (options.insecure) init.tls = { rejectUnauthorized: false };
      const response = await fetch(url, init);
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("text/html") || new URL(response.url).origin !== origin) {
        await response.body?.cancel();
        return { status: response.status };
      }
      return { status: response.status, html: parseHtml(await response.text()) };
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : undefined;
      return { status: code ?? (error instanceof Error ? error.name : "error") };
    }
  };

  let frontier = [withoutFragment(start)];
  refer(frontier[0], "(start)");
  while (frontier.length && fetched.size < maxPages) {
    const batch = frontier.filter((url) => !fetched.has(url)).slice(0, maxPages - fetched.size);
    for (const url of batch) fetched.set(url, { status: "pending" });
    const discovered: string[] = [];
    await runPool(batch, options.concurrency ?? 8, async (url) => {
      const result = await request(url);
      fetched.set(url, result);
      if (!result.html) return;
      for (const link of linksOf(result.html, url)) {
        const target = withoutFragment(link);
        if (options.ignore?.some((pattern) => pattern.test(link.href))) {
          skipped.add(link.href);
          continue;
        }
        if (link.origin !== origin) {
          if (/^https?:$/.test(link.protocol)) {
            external.add(target);
            refer(target, url);
          }
          continue;
        }
        refer(target, url);
        const fragment = decodeURIComponent(link.hash.slice(1));
        if (fragment && CHECKABLE_FRAGMENT.test(fragment)) {
          if (!fragments.has(target)) fragments.set(target, new Set());
          fragments.get(target)?.add(fragment);
        }
        if (!fetched.has(target)) discovered.push(target);
      }
    });
    frontier = [...new Set(discovered)];
  }

  if (options.external) {
    const targets = [...external];
    await runPool(targets, options.concurrency ?? 8, async (url) => {
      fetched.set(url, await request(url));
    });
  }

  const startResult = fetched.get(withoutFragment(start));
  if (!startResult?.html) {
    return {
      started: false,
      pages: 0,
      requested,
      broken: [{ url: start.href, status: startResult?.status ?? "error", referrers: ["(start)"] }],
      missingFragments: [],
      orphans: [],
      skipped: [],
      externalUnchecked: 0,
    };
  }

  const broken: Problem[] = [];
  for (const [url, result] of fetched) {
    const ok = typeof result.status === "number" && result.status < 400;
    if (!ok) broken.push({ url, status: result.status, referrers: [...(referrers.get(url) ?? [])].sort() });
  }

  const missingFragments: Problem[] = [];
  for (const [url, names] of fragments) {
    const page = fetched.get(url)?.html;
    if (!page) continue;
    const anchors = anchorsOf(page);
    for (const name of names) {
      if (!anchors.has(name))
        missingFragments.push({
          url: `${url}#${name}`,
          status: "missing anchor",
          referrers: [...(referrers.get(url) ?? [])].sort(),
        });
    }
  }

  const orphans: string[] = [];
  if (options.rootDir) {
    const reached = new Set(
      [...fetched.keys()]
        .map((url) => new URL(url))
        .filter((url) => url.origin === origin)
        .map((url) => url.pathname),
    );
    const base = start.pathname.endsWith("/") ? start.pathname : start.pathname.replace(/[^/]*$/, "");
    for (const file of new Bun.Glob("**/*.{html,md}").scanSync(options.rootDir)) {
      const path = file.split("\\").join("/");
      const direct = `${base}${path.split("/").map(encodeURIComponent).join("/")}`;
      const directory = direct.replace(/index\.(html|md)$/, "");
      if (!reached.has(direct) && !(direct !== directory && reached.has(directory))) orphans.push(path);
    }
    orphans.sort();
  }

  return {
    started: true,
    pages: [...fetched.values()].filter((result) => result.html).length,
    requested,
    broken: broken.sort((left, right) => left.url.localeCompare(right.url)),
    missingFragments,
    orphans,
    skipped: [...skipped].sort(),
    externalUnchecked: options.external ? 0 : external.size,
  };
}
