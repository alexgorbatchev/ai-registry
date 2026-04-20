import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

type IDateFields = {
  published: string;
  dateStatus: string;
  sourceDate: string;
  sourceDateType: string;
  dateNote: string;
};

type IEntry = IDateFields & {
  provider: string;
  slug: string;
  title: string;
  sourceUrl: string;
  fetchUrl: string;
  startAfter?: string;
  startAt?: string;
  endAt?: string;
};

type IFrontmatterField = {
  key: string;
  value: string;
};

const OUTPUT_ROOT = resolve(import.meta.dir, "..");
const CREATED_ON = formatCreatedOn(new Date());
const DOWNLOADED_AT = CREATED_ON.slice(0, 10);
const NOISE_LINES = new Set(["Copy page", "Loading...", "Copy for LLM Share feedback"]);
const UNAVAILABLE = "unavailable";
const MAX_FETCH_ATTEMPTS = 4;
const USER_AGENT = "Mozilla/5.0";
const ACCEPT_HEADER = "text/markdown,text/plain;q=0.9,*/*;q=0.8";

const ANTHROPIC_DATE_NOTE =
  "Anthropic's fetched docs content did not expose a stable per-page publish or update date.";
const MISTRAL_DATE_NOTE =
  "Mistral's fetched docs content did not expose a stable per-page publish or update date.";
const MISTRAL_COOKBOOK_DATE_NOTE =
  "Mistral's fetched cookbook content did not expose a stable per-page publish or update date.";
const OPENAI_DOCS_DATE_NOTE =
  "The docs page did not expose a trustworthy article publish date; proxy-level Published Time values appeared request-tied and were discarded.";

const ENTRIES: readonly IEntry[] = [
  {
    provider: "anthropic",
    slug: "prompt-engineering-overview",
    title: "Prompt engineering overview",
    sourceUrl: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview",
    fetchUrl: withJina("https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview"),
    ...createUnavailableDate(ANTHROPIC_DATE_NOTE),
    startAt: "# Prompt engineering overview",
    endAt: "Was this page helpful?",
  },
  {
    provider: "anthropic",
    slug: "prompting-best-practices",
    title: "Prompting best practices",
    sourceUrl:
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
    fetchUrl: withJina(
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
    ),
    ...createUnavailableDate(ANTHROPIC_DATE_NOTE),
    startAt: "# Prompting best practices",
    endAt: "Was this page helpful?",
  },
  {
    provider: "anthropic",
    slug: "console-prompting-tools",
    title: "Console prompting tools",
    sourceUrl:
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-tools",
    fetchUrl: withJina(
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-tools",
    ),
    ...createUnavailableDate(ANTHROPIC_DATE_NOTE),
    startAt: "# Console prompting tools",
    endAt: "Was this page helpful?",
  },
  {
    provider: "anthropic",
    slug: "context-windows",
    title: "Context windows",
    sourceUrl: "https://platform.claude.com/docs/en/build-with-claude/context-windows",
    fetchUrl: withJina("https://platform.claude.com/docs/en/build-with-claude/context-windows"),
    ...createUnavailableDate(ANTHROPIC_DATE_NOTE),
    startAt: "# Context windows",
    endAt: "Was this page helpful?",
  },
  {
    provider: "anthropic",
    slug: "context-editing",
    title: "Context editing",
    sourceUrl: "https://platform.claude.com/docs/en/build-with-claude/context-editing",
    fetchUrl: withJina("https://platform.claude.com/docs/en/build-with-claude/context-editing"),
    ...createUnavailableDate(ANTHROPIC_DATE_NOTE),
    startAt: "# Context editing",
    endAt: "Was this page helpful?",
  },
  {
    provider: "openai",
    slug: "prompting",
    title: "Prompting",
    sourceUrl: "https://developers.openai.com/api/docs/guides/prompting",
    fetchUrl: "https://developers.openai.com/api/docs/guides/prompting.md",
    ...createUnavailableDate(OPENAI_DOCS_DATE_NOTE),
  },
  {
    provider: "openai",
    slug: "prompt-engineering",
    title: "Prompt engineering",
    sourceUrl: "https://developers.openai.com/api/docs/guides/prompt-engineering",
    fetchUrl: "https://developers.openai.com/api/docs/guides/prompt-engineering.md",
    ...createUnavailableDate(OPENAI_DOCS_DATE_NOTE),
  },
  {
    provider: "openai",
    slug: "prompt-guidance-for-gpt-5-4",
    title: "Prompt guidance for GPT-5.4",
    sourceUrl: "https://developers.openai.com/api/docs/guides/prompt-guidance",
    fetchUrl: "https://developers.openai.com/api/docs/guides/prompt-guidance.md",
    ...createUnavailableDate(OPENAI_DOCS_DATE_NOTE),
  },
  {
    provider: "openai",
    slug: "prompt-caching",
    title: "Prompt caching",
    sourceUrl: "https://developers.openai.com/api/docs/guides/prompt-caching",
    fetchUrl: "https://developers.openai.com/api/docs/guides/prompt-caching.md",
    ...createUnavailableDate(OPENAI_DOCS_DATE_NOTE),
  },
  {
    provider: "openai",
    slug: "compaction",
    title: "Compaction",
    sourceUrl: "https://developers.openai.com/api/docs/guides/compaction",
    fetchUrl: "https://developers.openai.com/api/docs/guides/compaction.md",
    ...createUnavailableDate(OPENAI_DOCS_DATE_NOTE),
  },
  {
    provider: "openai",
    slug: "prompt-optimizer",
    title: "Prompt optimizer",
    sourceUrl: "https://developers.openai.com/api/docs/guides/prompt-optimizer",
    fetchUrl: "https://developers.openai.com/api/docs/guides/prompt-optimizer.md",
    ...createUnavailableDate(OPENAI_DOCS_DATE_NOTE),
  },
  {
    provider: "openai",
    slug: "reasoning-best-practices",
    title: "Reasoning best practices",
    sourceUrl: "https://developers.openai.com/api/docs/guides/reasoning-best-practices",
    fetchUrl: "https://developers.openai.com/api/docs/guides/reasoning-best-practices.md",
    ...createUnavailableDate(OPENAI_DOCS_DATE_NOTE),
  },
  {
    provider: "openai",
    slug: "realtime-models-prompting",
    title: "Prompting realtime models",
    sourceUrl: "https://developers.openai.com/api/docs/guides/realtime-models-prompting",
    fetchUrl: "https://developers.openai.com/api/docs/guides/realtime-models-prompting.md",
    ...createUnavailableDate("The docs page did not expose a trustworthy article publish date."),
  },
  {
    provider: "openai",
    slug: "codex-prompting-guide",
    title: "Codex Prompting Guide",
    sourceUrl: "https://cookbook.openai.com/examples/gpt-5/codex_prompting_guide",
    fetchUrl: withJina("https://cookbook.openai.com/examples/gpt-5/codex_prompting_guide"),
    ...createPublishedDate(
      "2026-02-25",
      "2026-02-25",
      "page_body",
      "The cookbook page includes an explicit publication date in the article body.",
    ),
    startAfter: "Copy Page More page actions",
    startAt: "# Codex Prompting Guide",
  },
  {
    provider: "google",
    slug: "prompt-design-strategies",
    title: "Prompt design strategies",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/prompting-strategies",
    fetchUrl: withJina("https://ai.google.dev/gemini-api/docs/prompting-strategies"),
    ...createPublishedDate(
      "2026-04-09",
      "2026-04-09T19:04:27Z",
      "page_metadata_published_time",
      "The page exposes a Published Time value in fetched metadata.",
    ),
    startAt: "# Prompt design strategies",
  },
  {
    provider: "google",
    slug: "system-instructions",
    title: "System instructions",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/system-instructions",
    fetchUrl: withJina("https://ai.google.dev/gemini-api/docs/system-instructions"),
    ...createPublishedDate(
      "2026-01-16",
      "2026-01-16T15:44:09Z",
      "page_metadata_published_time",
      "The page exposes a Published Time value in fetched metadata.",
    ),
    startAt: "# Text generation",
  },
  {
    provider: "google",
    slug: "long-context",
    title: "Long context",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/long-context",
    fetchUrl: withJina("https://ai.google.dev/gemini-api/docs/long-context"),
    ...createSourceDateOnly(
      "last_updated",
      "2026-01-12",
      "footer_last_updated",
      "The page did not expose a publish date, but its footer exposed an official last-updated date.",
    ),
    startAt: "# Long context",
  },
  {
    provider: "google",
    slug: "gemini-thinking",
    title: "Gemini thinking",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/thinking",
    fetchUrl: withJina("https://ai.google.dev/gemini-api/docs/thinking"),
    ...createSourceDateOnly(
      "last_updated",
      "2026-04-14",
      "footer_last_updated",
      "The page did not expose a publish date, but its footer exposed an official last-updated date.",
    ),
    startAt: "# Gemini thinking",
  },
  {
    provider: "mistral",
    slug: "prompting",
    title: "Prompting",
    sourceUrl: "https://docs.mistral.ai/models/best-practices/prompt-engineering",
    fetchUrl: withJina("https://docs.mistral.ai/models/best-practices/prompt-engineering"),
    ...createUnavailableDate(MISTRAL_DATE_NOTE),
    startAt: "# Prompting",
    endAt: "#### Contents",
  },
  {
    provider: "mistral",
    slug: "concept-deep-dive-prompt-optimization",
    title: "Concept Deep Dive: An Overview of Prompt Optimization",
    sourceUrl: "https://docs.mistral.ai/cookbooks/concept-deep-dive-prompting-prompt_optimization",
    fetchUrl: withJina(
      "https://docs.mistral.ai/cookbooks/concept-deep-dive-prompting-prompt_optimization",
    ),
    ...createUnavailableDate(MISTRAL_COOKBOOK_DATE_NOTE),
  },
  {
    provider: "mistral",
    slug: "prompting-capabilities-with-mistral-ai",
    title: "Prompting Capabilities with Mistral AI",
    sourceUrl: "https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities",
    fetchUrl: withJina("https://docs.mistral.ai/cookbooks/mistral-prompting-prompting_capabilities"),
    ...createUnavailableDate(MISTRAL_COOKBOOK_DATE_NOTE),
    startAt: "# Prompting Capabilities with Mistral AI",
    endAt: "### WHY MISTRAL",
  },
  {
    provider: "cohere",
    slug: "migrating-monolithic-prompts-to-command-a-with-rag",
    title: "Migrating Monolithic Prompts to Command A with RAG",
    sourceUrl: "https://docs.cohere.com/page/migrating-prompts",
    fetchUrl: withJina("https://docs.cohere.com/page/migrating-prompts"),
    ...createSourceDateOnly(
      "sitemap_lastmod",
      "2026-04-03T15:30:36.619Z",
      "sitemap_lastmod",
      "Cohere's sitemap exposed lastmod metadata, but the page fetch did not expose a publication date.",
    ),
  },
  {
    provider: "xai",
    slug: "prompt-caching-best-practices-and-faq",
    title: "Best Practices & FAQ",
    sourceUrl: "https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices",
    fetchUrl: withJina(
      "https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices",
    ),
    ...createPublishedDate(
      "2026-03-16",
      "2026-03-16T00:00:00Z",
      "page_metadata_published_time",
      "The page exposes both Published Time and Last updated values.",
    ),
    startAfter:
      "#### [Prompt Caching](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices#prompt-caching)",
    startAt: "# [Best Practices & FAQ]",
    endAt: "Did you find this page helpful?",
  },
  {
    provider: "llama",
    slug: "prompt-engineering",
    title: "Prompt engineering",
    sourceUrl: "https://www.llama.com/docs/how-to-guides/prompting/",
    fetchUrl: withJina("https://www.llama.com/docs/how-to-guides/prompting/"),
    ...createUnavailableDate(
      "Llama's fetched docs content did not expose a stable per-page publish or update date.",
    ),
  },
];

function withJina(url: string): string {
  return `https://r.jina.ai/http://${url}`;
}

function createUnavailableDate(dateNote: string): IDateFields {
  return {
    published: UNAVAILABLE,
    dateStatus: UNAVAILABLE,
    sourceDate: UNAVAILABLE,
    sourceDateType: UNAVAILABLE,
    dateNote,
  };
}

function createPublishedDate(
  published: string,
  sourceDate: string,
  sourceDateType: string,
  dateNote: string,
): IDateFields {
  return {
    published,
    dateStatus: "published",
    sourceDate,
    sourceDateType,
    dateNote,
  };
}

function createSourceDateOnly(
  dateStatus: string,
  sourceDate: string,
  sourceDateType: string,
  dateNote: string,
): IDateFields {
  return {
    published: UNAVAILABLE,
    dateStatus,
    sourceDate,
    sourceDateType,
    dateNote,
  };
}

function formatCreatedOn(value: Date): string {
  return `${value.getFullYear()}-${padNumber(value.getMonth() + 1)}-${padNumber(value.getDate())} ${padNumber(value.getHours())}:${padNumber(value.getMinutes())}`;
}

function padNumber(value: number): string {
  return value.toString().padStart(2, "0");
}

async function fetchText(url: string): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: ACCEPT_HEADER,
          "User-Agent": USER_AGENT,
        },
      });

      if (response.ok) {
        return await response.text();
      }

      const statusError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      lastError = statusError;

      if (response.status === 429 && attempt < MAX_FETCH_ATTEMPTS - 1) {
        await Bun.sleep(5000 * (attempt + 1));
        continue;
      }

      throw statusError;
    } catch (error) {
      lastError = getError(error);

      if (attempt === MAX_FETCH_ATTEMPTS - 1) {
        throw lastError;
      }

      await Bun.sleep(2000 * (attempt + 1));
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

function getError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function cleanContent(raw: string, entry: IEntry): string {
  let text = raw.replaceAll("\r\n", "\n");
  const markdownMarker = "Markdown Content:\n";
  const markdownIndex = text.indexOf(markdownMarker);

  if (markdownIndex >= 0) {
    text = text.slice(markdownIndex + markdownMarker.length);
  }

  if (entry.startAfter) {
    text = trimFromExactLine(text, entry.startAfter, false);
  }

  if (entry.startAt) {
    text = trimFromExactLine(text, entry.startAt, true);
  }

  if (entry.endAt) {
    const endIndex = text.indexOf(entry.endAt);
    if (endIndex >= 0) {
      text = text.slice(0, endIndex);
    }
  }

  const cleanedLines: string[] = [];
  for (const line of text.trim().split("\n")) {
    const strippedLine = line.trim();

    if (NOISE_LINES.has(strippedLine)) {
      continue;
    }

    if (strippedLine.includes("Copy for LLM") || strippedLine.includes("View as Markdown")) {
      continue;
    }

    if (strippedLine.startsWith("Title: ") || strippedLine.startsWith("URL Source: ")) {
      continue;
    }

    cleanedLines.push(line.replace(/[ \t]+$/u, ""));
  }

  let cleanedText = cleanedLines.join("\n").trim();
  cleanedText = cleanedText.replace(/\n{3,}/gu, "\n\n");
  cleanedText = cleanedText.replace(/^# \[(.+?)\]\(.+?\)$/mu, "# $1");
  cleanedText = cleanedText.replace(/^# (.+?) \| .+$/mu, "# $1");

  if (!cleanedText.trimStart().startsWith("#")) {
    cleanedText = `# ${entry.title}\n\n${cleanedText}`;
  }

  return `${cleanedText.trim()}\n`;
}

function trimFromExactLine(text: string, marker: string, includeMarker: boolean): string {
  const lines = text.split("\n");
  const markerIndex = lines.findIndex((line) => line.trim() === marker);

  if (markerIndex === -1) {
    return text;
  }

  return lines.slice(includeMarker ? markerIndex : markerIndex + 1).join("\n");
}

function createFrontmatter(fields: readonly IFrontmatterField[]): string {
  const body = fields.map(({ key, value }) => `${key}: ${JSON.stringify(value)}`).join("\n");
  return `---\n${body}\n---\n\n`;
}

function createArticleFrontmatter(entry: IEntry): string {
  return createFrontmatter([
    { key: "created_on", value: CREATED_ON },
    { key: "source_url", value: entry.sourceUrl },
    { key: "title", value: entry.title },
    { key: "provider", value: entry.provider },
    { key: "published", value: entry.published },
    { key: "date_status", value: entry.dateStatus },
    { key: "source_date", value: entry.sourceDate },
    { key: "source_date_type", value: entry.sourceDateType },
    { key: "date_note", value: entry.dateNote },
    { key: "downloaded_at", value: DOWNLOADED_AT },
  ]);
}

function createReadme(): string {
  const providerCounts = getProviderCounts(ENTRIES);
  const providerLines = [...providerCounts.entries()]
    .sort(([leftProvider], [rightProvider]) => leftProvider.localeCompare(rightProvider))
    .map(([provider, count]) => `- \`${provider}\`: ${count} article(s)`)
    .join("\n");

  const body = [
    "# Prompt Writing Corpus",
    "",
    "This directory contains downloaded official prompt-writing and context-engineering articles from major model providers.",
    "",
    "## Regenerate",
    "",
    "- Run `bun wiki/prompt-writing/scripts/downloadPromptWriting.ts`.",
    "",
    "## Inclusion criteria",
    "",
    "- Official provider docs, cookbooks, or guides only.",
    "- Primary topic must be prompt writing, prompt engineering, context engineering, long-context management, reasoning prompt guidance, prompt optimization, or explicit prompt/system-instruction guidance.",
    "- Generic API docs, model cards, and unrelated tool/RAG pages were excluded unless the page's main subject was prompting.",
    "",
    "## Providers",
    "",
    providerLines,
    "",
    "## Date fields",
    "",
    "- `published`: a trustworthy publication date when the source exposed one.",
    "- `date_status`: whether the date is a true publish date, an official last-updated or sitemap timestamp, or unavailable.",
    "- `source_date`: the raw official date value when a provider exposed only update-style metadata.",
    "- `date_note`: why a date is present or unavailable.",
  ].join("\n");

  return `${createFrontmatter([{ key: "created_on", value: CREATED_ON }])}${body}\n`;
}

function getProviderCounts(entries: readonly IEntry[]): Map<string, number> {
  const providerCounts = new Map<string, number>();

  for (const entry of entries) {
    const currentCount = providerCounts.get(entry.provider) ?? 0;
    providerCounts.set(entry.provider, currentCount + 1);
  }

  return providerCounts;
}

async function writeArticle(entry: IEntry): Promise<void> {
  const providerDirectory = resolve(OUTPUT_ROOT, entry.provider);
  const targetPath = resolve(providerDirectory, `${entry.slug}.md`);
  await mkdir(providerDirectory, { recursive: true });

  const rawContent = await fetchText(entry.fetchUrl);
  const cleanedContent = cleanContent(rawContent, entry);
  await Bun.write(targetPath, `${createArticleFrontmatter(entry)}${cleanedContent}`);
}

export async function downloadPromptWriting(): Promise<void> {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  await Bun.write(resolve(OUTPUT_ROOT, "README.md"), createReadme());

  const failures: string[] = [];

  for (const entry of ENTRIES) {
    try {
      await writeArticle(entry);
    } catch (error) {
      failures.push(`${entry.provider}/${entry.slug}: ${getError(error).message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}

if (import.meta.main) {
  downloadPromptWriting().catch((error) => {
    console.error(getError(error));
    process.exit(1);
  });
}
