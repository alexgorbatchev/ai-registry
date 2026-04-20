---
created_on: "2026-04-19 17:41"
---

# Prompt Writing Corpus

This directory contains downloaded official prompt-writing and context-engineering articles from major model providers.

## Regenerate

- Run `bun wiki/prompt-writing/scripts/downloadPromptWriting.ts`.

## Inclusion criteria

- Official provider docs, cookbooks, or guides only.
- Primary topic must be prompt writing, prompt engineering, context engineering, long-context management, reasoning prompt guidance, prompt optimization, or explicit prompt/system-instruction guidance.
- Generic API docs, model cards, and unrelated tool/RAG pages were excluded unless the page's main subject was prompting.

## Providers

- `anthropic`: 5 article(s)
- `cohere`: 1 article(s)
- `google`: 4 article(s)
- `llama`: 1 article(s)
- `mistral`: 3 article(s)
- `openai`: 9 article(s)
- `xai`: 1 article(s)

## Date fields

- `published`: a trustworthy publication date when the source exposed one.
- `date_status`: whether the date is a true publish date, an official last-updated or sitemap timestamp, or unavailable.
- `source_date`: the raw official date value when a provider exposed only update-style metadata.
- `date_note`: why a date is present or unavailable.
