---
name: firecrawl-cli
description: Use to scrape or crawl websites, map URLs, search the web, extract structured data from web pages, or run AI web agents.
author: alexgorbatchev
---

The `firecrawl` CLI provides four main commands:

1. **`scrape`**: Scrape a single page and get its content. Extracts structured data, markdown, or HTML.
2. **`map`**: Discover and map all URLs on a website quickly.
3. **`search`**: Search the web and optionally scrape the results.
4. **`agent`**: Search and gather data from the web using natural language prompts.

**Important**: 
- **DO NOT** set or override the `FIRECRAWL_API_URL` environment variable (e.g., `export FIRECRAWL_API_URL="https://api.firecrawl.dev"`). The system is intentionally configured to use a local private server. Rely on the default environment.
- You can output structured JSON using the `--json` flag or format flags.

### Quick Examples

- **Scrape to Markdown**:
  ```bash
  firecrawl scrape "https://example.com" --format markdown --output example.md
  ```

- **Scrape Structured Data**:
  ```bash
  firecrawl scrape "https://example.com" --schema '{"type":"object","properties":{"title":{"type":"string"}}}' --json
  ```

- **Map URLs**:
  ```bash
  firecrawl map "https://example.com" --limit 50 --output urls.json
  ```

- **Search and Scrape**:
  ```bash
  firecrawl search "latest AI news" --scrape --limit 5 --json
  ```

- **Run Web Agent**:
  ```bash
  firecrawl agent "Find the pricing of Mendable and save it" --wait --json
  ```

## Reference Documentation

For a full list of commands, flags, and advanced options, consult the reference documentation:
- See `references/firecrawl-cli.md` for detailed usage instructions and flags.
