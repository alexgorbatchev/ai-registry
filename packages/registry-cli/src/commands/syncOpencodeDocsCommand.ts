import { mkdir, mkdtemp, rename, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { getRegistryPaths } from "../lib/getRegistryPaths";

const SOURCE_OWNER = "anomalyco";
const SOURCE_REPO = "opencode";
const SOURCE_REF = "dev";
const SOURCE_DOCS_PATH = "packages/web/src/content/docs";
const GITHUB_API_BASE_URL = `https://api.github.com/repos/${SOURCE_OWNER}/${SOURCE_REPO}/contents`;
const RAW_CONTENT_BASE_URL = `https://raw.githubusercontent.com/${SOURCE_OWNER}/${SOURCE_REPO}/${SOURCE_REF}`;
const LOCALE_DIRECTORY_PATTERN = /^[a-z]{2}(?:-[a-z]{2})?$/;

type IGitHubContentEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
};

type IFileToSync = {
  relativePath: string;
  downloadUrl: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getObjectValue(object: object, key: string): unknown {
  return Reflect.get(object, key);
}

function isGitHubContentType(value: unknown): value is "file" | "dir" {
  return value === "file" || value === "dir";
}

function isGitHubContentEntry(value: unknown): value is IGitHubContentEntry {
  if (!isObject(value)) {
    return false;
  }
  const name = getObjectValue(value, "name");
  const path = getObjectValue(value, "path");
  const type = getObjectValue(value, "type");
  const downloadUrl = getObjectValue(value, "download_url");
  return (
    typeof name === "string" &&
    typeof path === "string" &&
    isGitHubContentType(type) &&
    (downloadUrl === null || typeof downloadUrl === "string")
  );
}

function isGitHubContentEntryList(value: unknown): value is IGitHubContentEntry[] {
  return Array.isArray(value) && value.every((entry) => isGitHubContentEntry(entry));
}

function getGitHubHeaders(): HeadersInit {
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-registry-opencode-docs-sync",
  });
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: getGitHubHeaders() });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API request failed for ${url}: ${response.status} ${response.statusText}\n${errorText}`);
  }
  return response.json();
}

async function downloadFile(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ai-registry-opencode-docs-sync",
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Download failed for ${url}: ${response.status} ${response.statusText}\n${errorText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function getSourcePath(relativePath: string): string {
  return relativePath ? `${SOURCE_DOCS_PATH}/${relativePath}` : SOURCE_DOCS_PATH;
}

function getRelativePath(entryPath: string): string {
  return entryPath.slice(SOURCE_DOCS_PATH.length + 1);
}

function getFallbackDownloadUrl(relativePath: string): string {
  return encodeURI(`${RAW_CONTENT_BASE_URL}/${SOURCE_DOCS_PATH}/${relativePath}`);
}

async function listDirectory(relativePath: string): Promise<IGitHubContentEntry[]> {
  const url = new URL(`${GITHUB_API_BASE_URL}/${getSourcePath(relativePath)}`);
  url.searchParams.set("ref", SOURCE_REF);
  const payload = await fetchJson(url.toString());
  if (!isGitHubContentEntryList(payload)) {
    throw new Error(`Unexpected GitHub directory payload for ${relativePath || SOURCE_DOCS_PATH}`);
  }
  return payload;
}

function getLocaleDirectories(entries: IGitHubContentEntry[]): Set<string> {
  return new Set(
    entries
      .filter((entry) => entry.type === "dir" && LOCALE_DIRECTORY_PATTERN.test(entry.name))
      .map((entry) => entry.name),
  );
}

async function collectFiles(
  relativePath: string,
  localeDirectories: Set<string>,
): Promise<IFileToSync[]> {
  const entries = await listDirectory(relativePath);
  const files: IFileToSync[] = [];
  for (const entry of entries) {
    const entryRelativePath = getRelativePath(entry.path);
    if (entry.type === "dir") {
      if (!relativePath && localeDirectories.has(entry.name)) {
        continue;
      }
      files.push(...(await collectFiles(entryRelativePath, localeDirectories)));
      continue;
    }
    files.push({
      relativePath: entryRelativePath,
      downloadUrl: entry.download_url || getFallbackDownloadUrl(entryRelativePath),
    });
  }
  return files;
}

async function writeSyncedFiles(stagingDocsDir: string, files: IFileToSync[]): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      const destinationPath = join(stagingDocsDir, file.relativePath);
      await mkdir(dirname(destinationPath), { recursive: true });
      await writeFile(destinationPath, await downloadFile(file.downloadUrl));
    }),
  );
}

export async function syncOpencodeDocsCommand(): Promise<void> {
  const { root, temp, harnesses } = getRegistryPaths();
  const targetDocsDir = join(harnesses, "opencode", "docs");
  
  await mkdir(temp, { recursive: true });
  const stagingRootDir = await mkdtemp(join(temp, "opencode-docs-"));
  const stagingDocsDir = join(stagingRootDir, "docs");

  try {
    const rootEntries = await listDirectory("");
    const localeDirectories = getLocaleDirectories(rootEntries);
    const files = await collectFiles("", localeDirectories);

    if (files.length === 0) {
      throw new Error(`No English docs found under ${SOURCE_DOCS_PATH}`);
    }

    await mkdir(stagingDocsDir, { recursive: true });
    await writeSyncedFiles(stagingDocsDir, files);

    await rm(targetDocsDir, { force: true, recursive: true });
    await rename(stagingDocsDir, targetDocsDir);

    console.log(`Synced ${files.length} English doc files into ${targetDocsDir}`);

    if (localeDirectories.size > 0) {
      console.log(`Skipped locale directories: ${Array.from(localeDirectories).sort().join(", ")}`);
    }
  } finally {
    await rm(stagingRootDir, { force: true, recursive: true });
  }
}
