---
created_on: "2026-04-19 17:41"
source_url: "https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices"
title: "Best Practices & FAQ"
provider: "xai"
published: "2026-03-16"
date_status: "published"
source_date: "2026-03-16T00:00:00Z"
source_date_type: "page_metadata_published_time"
date_note: "The page exposes both Published Time and Last updated values."
downloaded_at: "2026-04-19"
---

# Best Practices & FAQ

## [Best practices](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices#best-practices)

1.   **Always set `x-grok-conv-id`** (or `prompt_cache_key` for Responses API) — Routes requests to the same server, maximizing cache hits.

2.   **Use a stable conversation ID** — A UUID or your application's session ID works well.

3.   **Never modify earlier messages** — Only append new ones. Any edit, removal, or reorder breaks the cache.

4.   **Front-load static content** — Place system prompts, few-shot examples, and reference documents at the beginning where they form a stable prefix.

5.   **Monitor `cached_tokens`** — If consistently 0, verify your conversation ID and message ordering.

6.   **Handle cache misses gracefully** — Eviction and routing mean cache hits aren't guaranteed. Your application should work without caching.

* * *

## [Supported models](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices#supported-models)

Prompt caching is available on all `grok` language models. Check the [Models and Pricing](https://docs.x.ai/developers/models) page for details on which models support caching and their specific cached token pricing.

* * *

## [FAQ](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices#faq)

### [Does caching affect output quality?](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices#does-caching-affect-output-quality)

No. Caching only accelerates the prompt processing phase. The model's output is identical whether the prompt is served from cache or computed from scratch.

### [How long do cache entries persist?](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices#how-long-do-cache-entries-persist)

Cache entries can be evicted at any time due to server load or restarts. Use `x-grok-conv-id` to maximize retention by routing to the same server.

### [Can I force a cache miss?](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices#can-i-force-a-cache-miss)

Yes — use a different `x-grok-conv-id` or omit the header entirely. This will route your request to a potentially different server where no cache exists for your prompt.

### [Does caching work with streaming?](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices#does-caching-work-with-streaming)

Yes. Prompt caching works with both streaming and non-streaming requests. The first empty token in a stream corresponds to the cache lookup and prefill phase.

### [Does caching work with tool calls and function calling?](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/best-practices#does-caching-work-with-tool-calls-and-function-calling)

Yes. The cacheable prefix includes all messages up to and including tool call results. As long as the prefix remains unchanged, subsequent requests will benefit from caching.

* * *
