---
created_on: 2026-04-23 13:07
author: openai/gpt-5.4
source_url: multiple, see Sources
---

# InvokeAI + Civitai Model Compatibility Cheat Sheet

Created: 2026-04-23
Last updated: 2026-04-23

This is the fast path for browsing `https://civitai.com/models/` without pulling down a bunch of stuff that is annoying or misleading in `InvokeAI`.

## Core Rule

Filter by the model family you actually want to run, then match LoRAs to that exact family.

`InvokeAI` has first-class support for architectures like `SDXL`, `FLUX`, `FLUX.2`, `Qwen-Image`, and `Z-Image`, but not separate first-class base types for community families like `Pony`, `Illustrious`, or `NoobAI`. In practice, those community checkpoint families are treated as `SDXL`-family imports inside `InvokeAI`, but family-specific LoRAs should still be matched exactly to the checkpoint family they were trained on.

## Best Filter Presets

| Goal | Model type | Base model | Sort | Period | Why |
| --- | --- | --- | --- | --- | --- |
| Safe default lane | `Checkpoint` | `SDXL 1.0` | `Most Downloaded` | `Month` | Safest general import behavior in `InvokeAI` |
| Current anime/cartoon lane | `Checkpoint` | `Illustrious` | `Most Downloaded` | `Month` | Best current browsing lane for anime/cartoon models |
| More bleeding-edge anime/cartoon lane | `Checkpoint` | `NoobAI` | `Most Downloaded` | `Month` | Newer and often higher-ceiling, but more chaotic |
| Pony ecosystem lane | `Checkpoint` | `Pony` | `Most Downloaded` | `Month` | Only if you specifically want Pony LoRAs/workflows |
| FLUX lane | `Checkpoint` | `FLUX.1 Dev` or `FLUX.1 Schnell` | `Most Downloaded` | `Month` | Only if you intentionally want FLUX and have the VRAM |
| LoRA browsing | `LoRA` | exact match to your checkpoint family | `Most Downloaded` | `Month` | Prevents bad cross-family pairings |

If results look stale, keep `Most Downloaded` and tighten `Period` to `Week`. Do not switch straight to `Newest` as your main ranking, because that will surface random fresh merges with little signal.

## Family Matching Rules

Use these pairings:

- `SDXL 1.0` checkpoint -> `SDXL 1.0` LoRA
- `Illustrious` checkpoint -> `Illustrious` LoRA
- `NoobAI` checkpoint -> `NoobAI` LoRA
- `Pony` checkpoint -> `Pony` LoRA
- `FLUX.1` checkpoint -> `FLUX` LoRA or adapter built for that exact FLUX line
- `Qwen-Image` model -> `Qwen-Image` LoRA or adapter
- `Z-Image` model -> `Z-Image` adapter or model assets built for that family

Do not assume `Pony`, `Illustrious`, and `NoobAI` LoRAs are interchangeable just because they are all broadly `SDXL`-based.

## What To Check Before Downloading

- `Type` is `Checkpoint` or `LoRA`
- `Base model` matches the lane you filtered for
- primary file is a `.safetensors`
- page gives normal checkpoint guidance like sampler, steps, CFG, and recommended resolution
- license is acceptable for your use
- the page has actual adoption or credible examples, not just a brand-new merge with no signal

## Red Flags

Avoid these until you know exactly why you want them:

- `Embedding`
- `Hypernetwork`
- random same-day merges with no traction
- pages that do not clearly state the base model family
- pages that only make sense with a specific `A1111` or Forge extension stack
- very old checkpoints when your goal is current anime/cartoon quality

For the last point, use this recency rule of thumb for fast-moving anime/cartoon checkpoints:

- `< 2 months`: current contender
- `2-6 months`: aging fast, still worth checking if adoption is strong
- `6+ months`: ecosystem or compatibility pick
- `12+ months`: historical unless it is still the anchor for a specific LoRA ecosystem

## Best Starting Workflow On Civitai

1. Choose `Checkpoint` first.
2. Filter to one base-model family.
3. Sort by `Most Downloaded` and set `Period` to `Month`.
4. Open 3-5 candidates.
5. Reject anything with weak usage notes, weird licensing, or unclear family tagging.
6. Pick one checkpoint.
7. Only then browse `LoRA` models for that exact same family.

## InvokeAI Import Reminder

`InvokeAI` can import models from:

- local file paths
- URLs
- Hugging Face repo IDs
- scanned local folders

For Civitai models, the cleanest path is usually either a direct `.safetensors` download or importing from the model URL/direct download URL through the model manager.

## Practical Starting Presets

If you want simple defaults:

- safest general `InvokeAI` browsing: `Checkpoint` + `SDXL 1.0` + `Most Downloaded` + `Month`
- current anime/cartoon browsing: `Checkpoint` + `Illustrious` + `Most Downloaded` + `Month`
- more aggressive anime/cartoon browsing: `Checkpoint` + `NoobAI` + `Most Downloaded` + `Month`
- only if you need Pony assets: `Checkpoint` + `Pony` + `Most Downloaded` + `Month`
- once you have a checkpoint: `LoRA` + exact same family + `Most Downloaded` + `Month`

## Sources

- [InvokeAI model concepts](https://github.com/invoke-ai/InvokeAI/blob/main/docs/src/content/docs/concepts/models.mdx)
- [InvokeAI model manager architecture](https://github.com/invoke-ai/InvokeAI/blob/main/docs/src/content/docs/development/Architecture/model-manager.mdx)
- [InvokeAI base model taxonomy](https://github.com/invoke-ai/InvokeAI/blob/main/invokeai/backend/model_manager/configs/taxonomy.py)
- [Nova Anime XL](https://civitai.com/models/376130)
- [Chenkin Noob XL](https://civitai.com/models/2167995)
- [AniKawaXL](https://civitai.com/models/1282887)
