# Firecrawl CLI Reference

This reference details the capabilities and flags of the `firecrawl` command-line tool. 

## Global Flags
These flags are available on all commands:
- `--api-key string`: Firecrawl API key (defaults to `FIRECRAWL_API_KEY` env var)
- `--api-url string`: Firecrawl API base URL (defaults to `FIRECRAWL_API_URL` env var)
- `--json`: Output results as raw JSON instead of human-friendly formatting
- `--help`: Show help for the command

## Commands

### 1. Scrape
Scrape a single URL and return its structured or unstructured content.

```bash
firecrawl scrape [URL] [flags]
```

**Key Flags:**
- `--format strings`: Output formats (comma-separated): `markdown`, `html`, `rawHtml`, `links`, `screenshot`, `json`, `images`, `summary`, `changeTracking`, `attributes`, `branding` (default `[markdown]`)
- `--output string`: Save output to file
- `--schema string`: JSON schema for structured extraction (inline JSON string)
- `--schema-file string`: Path to JSON schema file
- `--json-prompt string`: Prompt for structural JSON extraction
- `--actions string`: JSON actions array to run during scrape (inline JSON), e.g., click, scroll, etc.
- `--actions-file string`: Path to JSON actions file
- `--only-main-content`: Extract only main content (default `true`)
- `--include-tags strings` / `--exclude-tags strings`: HTML tags to include/exclude (comma-separated)
- `--mobile`: Enable mobile user-agent scraping
- `--block-ads`: Block advertisement elements
- `--screenshot`: Take a screenshot
- `--full-page-screenshot`: Take a full page screenshot
- `--wait-for int`: Wait time in milliseconds for JS rendering
- `--timeout duration`: Timeout for the API client operations (e.g., 30s, 5m) (default `5m0s`)

### 2. Map
Discover and map URLs on a website starting from a given root URL.

```bash
firecrawl map [URL] [flags]
```

**Key Flags:**
- `--limit int`: Maximum URLs to discover (default `100`)
- `--output string`: Save output to file
- `--detailed`: Show details like title and description for discovered links
- `--search string`: Filter URLs by search query
- `--include-subdomains`: Include subdomains in mapped URLs
- `--ignore-query-parameters`: Treat URLs with different params as same
- `--sitemap string`: Sitemap handling: `include`, `skip`, `only`, or custom sitemap URL
- `--wait`: Wait for map to complete
- `--timeout int`: Timeout in seconds

### 3. Search
Search the web and return scraped content for matching results.

```bash
firecrawl search [QUERY] [flags]
```

**Key Flags:**
- `--scrape`: Scrape search results
- `--scrape-formats strings`: Formats for scraped content (comma-separated) (default `[markdown]`)
- `--limit int`: Maximum number of search results to return (max: `100`, default `5`)
- `--output string`: Save output to file
- `--sources strings`: Sources to search (comma-separated): `web`, `images`, `news`
- `--categories strings`: Filter by category (comma-separated): `github`, `research`, `pdf`
- `--country string`: ISO country code for geotargeting (default `"US"`)
- `--tbs string`: Time-based search restriction (e.g. `qdr:d` for past day, `qdr:w` for past week)

### 4. Agent
Run an AI-powered Firecrawl agent with a prompt to discover, navigate, and extract structured data from websites.

```bash
firecrawl agent [PROMPT/JOB-ID] [flags]
```

**Key Flags:**
- `--wait`: Wait for agent to complete before returning results
- `--output string`: Save output to file
- `--schema string`: JSON schema for structured output (inline JSON string)
- `--schema-file string`: Path to JSON schema file for structured output
- `--urls strings`: Optional list of URLs to focus the agent on (comma-separated)
- `--strict-constrain-to-urls`: Strictly restrict the agent to only visit the provided seed URLs
- `--model string`: Model to use: `spark-1-mini` or `spark-1-pro`
- `--max-credits int`: Maximum credits to spend
- `--status`: Check status of existing agent job
- `--cancel`: Cancel an active agent job by job ID