import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { existsSync } from "fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";

import { syncOpencodeDocsCommand, type ISyncOpencodeDocsDependencies } from "../syncOpencodeDocsCommand";
import type { IRegistryPaths } from "../../lib/getRegistryPaths";

const TEST_ROOT = join(import.meta.dir, "..", "..", "..", ".tmp", "sync-opencode-docs-tests");
const API_ROOT = "https://api.github.com/repos/anomalyco/opencode/contents/packages/web/src/content/docs";
const RAW_ROOT = "https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/web/src/content/docs";
const DOCS_PATH = "packages/web/src/content/docs";

type IFakeResponse = { status: number; body: string };

describe("syncOpencodeDocsCommand", () => {
  let root: string;
  let registryPaths: IRegistryPaths;
  let responses: Map<string, IFakeResponse>;
  let requests: Array<{ url: string; authorization: string | null }>;
  let logLines: string[];

  function createDependencies(githubToken?: string): ISyncOpencodeDocsDependencies {
    return {
      registryPaths,
      githubToken,
      fetch: async (url, init) => {
        requests.push({ url, authorization: new Headers(init.headers).get("Authorization") });
        const response = responses.get(url) ?? { status: 404, body: "missing" };
        return new Response(response.body, { status: response.status, statusText: response.status === 200 ? "OK" : "Not Found" });
      },
    };
  }

  function listing(entries: Array<{ name: string; type: "file" | "dir"; download_url?: string | null }>, prefix = ""): string {
    return JSON.stringify(entries.map((entry) => ({
      name: entry.name,
      path: `${DOCS_PATH}/${prefix}${entry.name}`,
      type: entry.type,
      download_url: entry.download_url ?? null,
    })));
  }

  function serveDefaultDocs(): void {
    responses.set(`${API_ROOT}?ref=dev`, {
      status: 200,
      body: listing([
        { name: "index.mdx", type: "file", download_url: "https://download.test/index.mdx" },
        { name: "my page.mdx", type: "file" },
        { name: "guides", type: "dir" },
        { name: "de", type: "dir" },
        { name: "zh-cn", type: "dir" },
      ]),
    });
    responses.set(`${API_ROOT}/guides?ref=dev`, {
      status: 200,
      body: listing([{ name: "setup.mdx", type: "file", download_url: "https://download.test/setup.mdx" }], "guides/"),
    });
    responses.set("https://download.test/index.mdx", { status: 200, body: "# Index\n" });
    responses.set(`${RAW_ROOT}/my%20page.mdx`, { status: 200, body: "# My page\n" });
    responses.set("https://download.test/setup.mdx", { status: 200, body: "# Setup\n" });
  }

  beforeEach(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    root = await mkdtemp(join(TEST_ROOT, "case-"));
    registryPaths = {
      root,
      overlay: null,
      harnesses: join(root, "harnesses"),
      skills: join(root, "skills"),
      commands: join(root, "commands"),
      profiles: join(root, "profiles"),
      output: join(root, ".output"),
      temp: join(root, ".tmp"),
    };
    responses = new Map();
    requests = [];
    logLines = [];
    spyOn(console, "log").mockImplementation((...values: unknown[]) => {
      logLines.push(values.join(" "));
    });
  });

  afterEach(async () => {
    mock.restore();
    await rm(root, { recursive: true, force: true });
  });

  it("replaces the docs snapshot with the English docs, skipping locale directories", async () => {
    serveDefaultDocs();
    const docsDir = join(registryPaths.harnesses, "opencode", "docs");
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, "stale.mdx"), "old\n");

    await syncOpencodeDocsCommand(createDependencies("secret-token"));

    expect((await readdir(docsDir, { recursive: true })).sort()).toEqual([
      "guides",
      "guides/setup.mdx",
      "index.mdx",
      "my page.mdx",
    ]);
    expect(await readFile(join(docsDir, "my page.mdx"), "utf-8")).toBe("# My page\n");
    expect(requests.filter((request) => request.url.startsWith(API_ROOT)).map((request) => request.authorization)).toEqual([
      "Bearer secret-token",
      "Bearer secret-token",
      "Bearer secret-token",
    ]);
    expect(logLines).toEqual([
      `Synced 3 English doc files into ${docsDir}`,
      "Skipped locale directories: de, zh-cn",
    ]);
    expect(await readdir(registryPaths.temp)).toEqual([]);
  });

  it("sends no authorization without a token and keeps the snapshot on a failed listing", async () => {
    const docsDir = join(registryPaths.harnesses, "opencode", "docs");
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, "kept.mdx"), "kept\n");

    await expect(syncOpencodeDocsCommand(createDependencies())).rejects.toThrow(
      `GitHub API request failed for ${API_ROOT}?ref=dev: 404 Not Found\nmissing`,
    );
    expect(requests).toEqual([{ url: `${API_ROOT}?ref=dev`, authorization: null }]);
    expect(await readFile(join(docsDir, "kept.mdx"), "utf-8")).toBe("kept\n");
  });

  it("rejects a listing that is not a GitHub directory payload", async () => {
    responses.set(`${API_ROOT}?ref=dev`, { status: 200, body: JSON.stringify({ message: "not a directory" }) });

    await expect(syncOpencodeDocsCommand(createDependencies())).rejects.toThrow(
      `Unexpected GitHub directory payload for ${DOCS_PATH}`,
    );
  });

  it("rejects a source with no English docs", async () => {
    responses.set(`${API_ROOT}?ref=dev`, { status: 200, body: listing([{ name: "de", type: "dir" }]) });

    await expect(syncOpencodeDocsCommand(createDependencies())).rejects.toThrow(`No English docs found under ${DOCS_PATH}`);
  });

  it("keeps the snapshot when a download fails", async () => {
    serveDefaultDocs();
    responses.delete("https://download.test/setup.mdx");

    await expect(syncOpencodeDocsCommand(createDependencies())).rejects.toThrow(
      "Download failed for https://download.test/setup.mdx: 404 Not Found\nmissing",
    );
    expect(existsSync(join(registryPaths.harnesses, "opencode", "docs"))).toBe(false);
  });
});
