---
created_on: 2026-04-22 12:11
author: openai/gpt-5.4
source_url: multiple, see Sources Reviewed
---

# Self-Hosted AI Image Generation Applications

Created: 2026-04-22
Last updated: 2026-04-22

## Original Prompt

> selfhosted applications for ai image generatation

## Executive Summary

If you are choosing a self-hosted AI image-generation application in 2026 and you want one default recommendation, choose `ComfyUI`. The first-party evidence is the strongest there: it has the broadest actively documented model support, a recent and frequent release cadence, strong local/offline positioning, a real API and workflow format, and explicit support for low-VRAM/offloading workflows across a wide range of hardware ([ComfyUI docs](https://docs.comfy.org/), [ComfyUI README](https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/README.md), [ComfyUI system requirements](https://docs.comfy.org/installation/system_requirements), [ComfyUI latest release v0.19.3](https://github.com/Comfy-Org/ComfyUI/releases/tag/v0.19.3)).

`InvokeAI` is the strongest alternative when your priority is a more opinionated, polished creative workflow rather than raw graph-first flexibility. Its strongest differentiators are the Unified Canvas, a more professionalized UI, a model manager, active current-model support, and new experimental multi-user mode for shared instances ([InvokeAI docs](https://invoke.ai/), [InvokeAI README](https://raw.githubusercontent.com/invoke-ai/InvokeAI/main/README.md), [InvokeAI hardware requirements](https://invoke.ai/start-here/system-requirements/), [InvokeAI v6.12.0 release notes](https://github.com/invoke-ai/InvokeAI/releases/tag/v6.12.0)).

`SwarmUI` is the most interesting dark horse for shared or hybrid deployments. The official project pitch is essentially: easy Generate tab for normal users, deeper workflow access for advanced users, and an architecture that can sit on top of `ComfyUI` and optionally `AUTOMATIC1111` backends. That makes it unusually relevant if you are self-hosting for more than one person, but its own README still labels it `Beta`, so it is harder to recommend as the safest default than `ComfyUI` or `InvokeAI` ([SwarmUI README](https://raw.githubusercontent.com/mcmonkeyprojects/SwarmUI/master/README.md), [SwarmUI latest release 0.9.8-Beta](https://github.com/mcmonkeyprojects/SwarmUI/releases/tag/0.9.8-Beta)).

`AUTOMATIC1111` remains important because of its huge installed base and extension ecosystem, but the evidence in 2026 points to it more as a legacy baseline than the best new deployment choice. It is still active and very popular, but the newer momentum in model support and practitioner recommendations has shifted toward `ComfyUI`, with `InvokeAI` and `SwarmUI` covering other needs ([AUTOMATIC1111 README](https://github.com/AUTOMATIC1111/stable-diffusion-webui), [GitHub repo metadata](https://github.com/AUTOMATIC1111/stable-diffusion-webui), [ToolHalla comparison, 2026](https://toolhalla.ai/blog/comfyui-vs-invokeai-vs-fooocus-2026), [TechTactician comparison, 2025](https://techtactician.com/comfyui-vs-automatic1111-vs-fooocus-comparison/)).

`Fooocus` is still the easiest quick-start recommendation for a single user who wants good results with minimal tuning, but its own official README is the reason it drops sharply in a greenfield 2026 recommendation: the project is in bug-fix-only LTS mode, has no stated plan to adopt newer model architectures, and explicitly points people toward `WebUI Forge` and `ComfyUI/SwarmUI` for newer models such as `Flux` ([Fooocus README](https://github.com/lllyasviel/Fooocus), [Fooocus latest release v2.5.5](https://github.com/lllyasviel/Fooocus/releases/tag/v2.5.5)).

## Short Answer Or Recommendation

Use this policy:

1. If you want one best overall self-hosted choice for 2026, choose `ComfyUI`.
2. If your users are artists or creative operators who care more about canvas editing, image management, and a more guided UX than raw graph flexibility, choose `InvokeAI`.
3. If you are hosting for multiple users and want a friendlier front door with a deeper workflow escape hatch, shortlist `SwarmUI`.
4. If you already depend on the `AUTOMATIC1111` ecosystem, keep it, but do not treat it as the strongest fresh recommendation.
5. If you want the fastest route to a first good image and accept strategic limits, `Fooocus` is still viable for a personal install, but it is not a strong long-term platform bet.

If forced to choose exactly one application for a new self-hosted deployment, choose `ComfyUI`.

## Rating System

This report uses a 1-10 scale. The numbers are judgment scores based on the cited evidence, not vendor-provided benchmarks.

- `9-10`: class-leading for the intended self-hosted use case, with only minor caveats.
- `7-8`: strong option with clear strengths, but meaningful tradeoffs.
- `5-6`: usable and sometimes compelling, but with strategic or operational caveats.
- `3-4`: niche or dated for new adoption.
- `1-2`: poor fit for most new self-hosted deployments.

Overall scores weight these criteria:

- capability and model support: 25%
- deployment and self-hosting fit: 20%
- maintenance and future-proofing: 20%
- automation and integration: 20%
- UX and learnability: 15%

## Compared Approaches Or Options

| Option | Overall | Best fit |
| --- | --- | --- |
| `ComfyUI` | 8.5/10 | Best overall and most future-proof |
| `InvokeAI` | 8.2/10 | Best for polished creative workflows |
| `SwarmUI` | 7.8/10 | Best hybrid/shared-instance candidate |
| `AUTOMATIC1111` | 6.6/10 | Best if you already depend on its ecosystem |
| `Fooocus` | 4.8/10 | Best only for easiest single-user onboarding |

### `ComfyUI` - 8.5/10 overall, best default recommendation

The official case for `ComfyUI` is unusually strong. It is explicitly positioned as a node-based application and inference engine for generative AI, supports local installation across Windows, Linux, and macOS, and documents support for a very broad set of modern model families including SD 1.x/2.x, SDXL, SD3/3.5, `Flux`, `Qwen Image`, `Hunyuan Image 2.1`, `Flux 2`, `Z Image`, plus video, audio, and 3D models. The README also calls out asynchronous queueing, partial re-execution of only changed workflow segments, low-VRAM offloading, offline-by-default operation, an API, and JSON workflow portability, all of which matter directly in self-hosted environments ([ComfyUI docs](https://docs.comfy.org/), [ComfyUI README](https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/README.md)).

The maintenance signals are also excellent. `ComfyUI` had a release on 2026-04-17 and a repo push on 2026-04-22, which is stronger recent motion than the other compared projects except perhaps `InvokeAI` on raw push activity ([ComfyUI latest release v0.19.3](https://github.com/Comfy-Org/ComfyUI/releases/tag/v0.19.3), [GitHub repo metadata](https://github.com/Comfy-Org/ComfyUI)). Practitioner sources line up with that story: both a 2025 hands-on comparison and a 2025 engineering case study converge on `ComfyUI` as the long-term platform once the user needs deeper control, reproducibility, or better preservation of image details in production-style workflows ([TechTactician comparison, 2025](https://techtactician.com/comfyui-vs-automatic1111-vs-fooocus-comparison/), [KeyValue engineering case study, 2025](https://www.keyvalue.systems/blog/webui-forge-evolution-automatic1111-to-comfyui-stable-diffusion/)).

The main reason it is not a perfect 10 is usability and operations. The graph-first model is inherently more demanding than the other UIs, Linux lacks a desktop prebuild, and once you expose it beyond localhost you need to solve authentication, reverse proxying, and TLS correctly. Even the official TLS example warns that the self-signed certificate example is not appropriate for shared or production use ([ComfyUI system requirements](https://docs.comfy.org/installation/system_requirements), [ComfyUI README](https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/README.md), [selfhosting.sh guide, 2026](https://selfhosting.sh/apps/comfyui/)).

### `InvokeAI` - 8.2/10 overall, best polished alternative

`InvokeAI` is the strongest non-`ComfyUI` recommendation because its first-party product story is coherent and current. It presents itself as a self-hosted creative engine with Unified Canvas, node-based workflows, a model manager, and local/private operation. Its current docs and README show support for modern model families including SDXL, SD 3.5, `Flux`, `CogView 4`, `Qwen Image`, and `Z-Image`, and its March 2026 release added experimental multi-user mode with separate accounts, per-user galleries/settings, new model support, and a REST endpoint for setting generation parameters remotely ([InvokeAI docs](https://invoke.ai/), [InvokeAI README](https://raw.githubusercontent.com/invoke-ai/InvokeAI/main/README.md), [InvokeAI v6.12.0 release notes](https://github.com/invoke-ai/InvokeAI/releases/tag/v6.12.0)).

For self-hosting, `InvokeAI` looks more operationally opinionated than `ComfyUI` and easier to hand to less technical users. The official launcher is the recommended install path on Windows, macOS, and Linux. The hardware guidance is also relatively concrete, with documented model-family VRAM targets and an explicit low-VRAM guide. That reduces ambiguity for operators deciding whether a machine can realistically run SDXL, `FLUX.1`, or `FLUX.2 Klein` workloads ([InvokeAI installation](https://invoke.ai/start-here/installation/), [InvokeAI hardware requirements](https://invoke.ai/start-here/system-requirements/)).

The main limit is that `InvokeAI` is not the ecosystem center of gravity in the same way `ComfyUI` is. It is current and serious, but the broader practitioner momentum still tilts toward `ComfyUI` for power users and future-proofing. So the recommendation is conditional: if you want better guided UX and canvas-centric creative work, `InvokeAI` may be the better choice; if you want the highest-ceiling platform, `ComfyUI` still wins ([ToolHalla comparison, 2026](https://toolhalla.ai/blog/comfyui-vs-invokeai-vs-fooocus-2026), [TechTactician comparison, 2025](https://techtactician.com/comfyui-vs-automatic1111-vs-fooocus-comparison/)).

### `SwarmUI` - 7.8/10 overall, best hybrid/shared-instance candidate

`SwarmUI` is the most underrated option in this comparison. Its official README describes exactly the kind of split that matters in self-hosting: a simple Generate tab for beginners, a deeper Comfy Workflow tab for advanced users, support for modern image and video models, and the ability to auto-install or use `ComfyUI` and optionally `AUTOMATIC1111` backends. The 0.9.8-Beta release notes add more evidence that it is thinking like a server platform, with experimental auto-scaling backends and optional public-user registration for shared instances ([SwarmUI README](https://raw.githubusercontent.com/mcmonkeyprojects/SwarmUI/master/README.md), [SwarmUI latest release 0.9.8-Beta](https://github.com/mcmonkeyprojects/SwarmUI/releases/tag/0.9.8-Beta)).

That makes `SwarmUI` especially attractive if the question is not just "what should I run for myself on one workstation?" but also "what should I host for a small team, lab, or hobby community?" In that scenario, `SwarmUI` arguably has a clearer product concept than `AUTOMATIC1111`, because it explicitly tries to bridge novice and advanced use while staying current on new models ([SwarmUI README](https://raw.githubusercontent.com/mcmonkeyprojects/SwarmUI/master/README.md)).

The reason it still ranks below `ComfyUI` and `InvokeAI` is maturity risk. The project still calls itself `Beta`, its install base is much smaller, and its own README lists important unfinished targets such as better mobile browser support and more polished direct distribution. It looks promising, not fully settled ([SwarmUI README](https://raw.githubusercontent.com/mcmonkeyprojects/SwarmUI/master/README.md), [GitHub repo metadata](https://github.com/mcmonkeyprojects/SwarmUI)).

### `AUTOMATIC1111` - 6.6/10 overall, strong legacy baseline but weaker greenfield choice

The strongest case for `AUTOMATIC1111` is still its ecosystem gravity. The project remains enormous by GitHub adoption, exposes a broad feature set, supports an API, and still spans a large set of hardware and classic Stable Diffusion workflows. If a user already has extensions, scripts, and team habits built around it, switching is not free, and that matters in real decisions ([AUTOMATIC1111 README](https://github.com/AUTOMATIC1111/stable-diffusion-webui), [GitHub repo metadata](https://github.com/AUTOMATIC1111/stable-diffusion-webui)).

The problem is that none of the strongest 2025-2026 evidence points to `AUTOMATIC1111` as the best fresh recommendation. Editorial and practitioner sources repeatedly frame it as the old standard: good, familiar, and still useful, but increasingly superseded by `ComfyUI` for future-facing workflows and by more guided tools for ease of use. Even the KeyValue case study treats it as the starting point before moving on to `Forge` and then `ComfyUI` for better control and output quality in a production workflow ([ToolHalla comparison, 2026](https://toolhalla.ai/blog/comfyui-vs-invokeai-vs-fooocus-2026), [TechTactician comparison, 2025](https://techtactician.com/comfyui-vs-automatic1111-vs-fooocus-comparison/), [KeyValue engineering case study, 2025](https://www.keyvalue.systems/blog/webui-forge-evolution-automatic1111-to-comfyui-stable-diffusion/)).

So the right recommendation is conservative rather than enthusiastic: keep using `AUTOMATIC1111` if you already benefit from its ecosystem, but do not choose it first for a new 2026 self-hosted deployment unless a specific extension or compatibility requirement forces the decision.

### `Fooocus` - 4.8/10 overall, easiest entry point but weak new strategic choice

`Fooocus` still has a real use case. Its official positioning is simple, prompt-focused generation with very little manual tuning, and the hardware requirements are friendlier than some alternatives. Multiple practitioner sources still recommend it as the easiest place for a beginner to get good-looking outputs quickly ([Fooocus README](https://github.com/lllyasviel/Fooocus), [TechTactician comparison, 2025](https://techtactician.com/comfyui-vs-automatic1111-vs-fooocus-comparison/), [ToolHalla comparison, 2026](https://toolhalla.ai/blog/comfyui-vs-invokeai-vs-fooocus-2026)).

But the strategic downside is not subtle. The official README says the project is in `Limited Long-Term Support (LTS) with Bug Fixes Only`, says there are no current plans to incorporate newer model architectures, and directly recommends other tools for newer models. That is unusually strong first-party evidence against greenfield adoption for anyone who cares about staying current on model support in 2026 ([Fooocus README](https://github.com/lllyasviel/Fooocus)).

It also has a notable self-hosting security footgun: if you expose `Fooocus` remotely with `--listen` or `--share`, it is unauthenticated by default unless you configure `auth.json`. That is exactly the kind of default that makes a single-user desktop app okay but a casual server deployment risky ([Fooocus README](https://github.com/lllyasviel/Fooocus)).

## Common Patterns And Best Practices

Across the sources, several patterns are consistent:

- The market has clearly separated into graph-first power tools and guided creative tools. `ComfyUI` sits at the power end, `InvokeAI` at the polished-creative end, and `SwarmUI` tries to bridge the two ([ComfyUI docs](https://docs.comfy.org/), [InvokeAI docs](https://invoke.ai/), [SwarmUI README](https://raw.githubusercontent.com/mcmonkeyprojects/SwarmUI/master/README.md)).
- Current-model support and release cadence matter more in 2026 than pure historical popularity. That is why `ComfyUI` and `InvokeAI` score so well, and why `Fooocus` drops despite good beginner UX ([ComfyUI latest release v0.19.3](https://github.com/Comfy-Org/ComfyUI/releases/tag/v0.19.3), [InvokeAI v6.12.0 release notes](https://github.com/invoke-ai/InvokeAI/releases/tag/v6.12.0), [Fooocus README](https://github.com/lllyasviel/Fooocus)).
- Self-hosting is not only about local inference. It is also about queueing, workflow portability, model management, backup strategy, authentication, reverse proxying, and disk hygiene. The strongest products expose those concerns more explicitly rather than hiding them ([ComfyUI README](https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/README.md), [InvokeAI v6.12.0 release notes](https://github.com/invoke-ai/InvokeAI/releases/tag/v6.12.0), [selfhosting.sh guide, 2026](https://selfhosting.sh/apps/comfyui/)).
- For serious repeatable work, reusable workflows matter more than raw prompt convenience. That is a major reason practitioner sources graduate from `AUTOMATIC1111` or `Fooocus` toward `ComfyUI` over time ([KeyValue engineering case study, 2025](https://www.keyvalue.systems/blog/webui-forge-evolution-automatic1111-to-comfyui-stable-diffusion/), [TechTactician comparison, 2025](https://techtactician.com/comfyui-vs-automatic1111-vs-fooocus-comparison/)).

## Disagreements Or Tensions

The biggest disagreement is not about features but about the definition of "best." If best means highest ceiling, fastest adoption of new models, strongest automation story, and most future-proof workflows, the evidence points to `ComfyUI`. If best means highest operator productivity for artists who do not want to think in graphs all day, `InvokeAI` can be the better answer despite the lower ecosystem gravity ([ComfyUI README](https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/README.md), [InvokeAI docs](https://invoke.ai/)).

There is also a tension between popularity and momentum. `AUTOMATIC1111` still dominates on historic GitHub stars, but that does not automatically make it the best new deployment choice. The more decision-relevant signals for 2026 are recent releases, model support, and practitioner migration paths, and those signals lean elsewhere ([GitHub repo metadata](https://github.com/AUTOMATIC1111/stable-diffusion-webui), [GitHub repo metadata](https://github.com/Comfy-Org/ComfyUI), [KeyValue engineering case study, 2025](https://www.keyvalue.systems/blog/webui-forge-evolution-automatic1111-to-comfyui-stable-diffusion/)).

Finally, the performance story is noisy. Comparative speed and VRAM claims exist, but much of that evidence comes from editorial comparisons or practitioner anecdotes rather than standardized public benchmarks under identical hardware, model, and workflow conditions. Those claims are directionally useful, but weaker than the official support and release data used elsewhere in this report ([ToolHalla comparison, 2026](https://toolhalla.ai/blog/comfyui-vs-invokeai-vs-fooocus-2026), [TechTactician comparison, 2025](https://techtactician.com/comfyui-vs-automatic1111-vs-fooocus-comparison/)).

## Risks And Anti-patterns

- Do not choose a platform only because it has the biggest historical community. That overweights old adoption and underweights current model support and release velocity.
- Do not expose these tools directly to the public internet without solving authentication and reverse proxying first. `Fooocus` is unauthenticated by default for remote exposure unless you add `auth.json`, and `ComfyUI`'s self-signed TLS example is explicitly not meant for production sharing ([Fooocus README](https://github.com/lllyasviel/Fooocus), [ComfyUI README](https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/README.md)).
- Do not treat beginner UX as the same thing as long-term platform fitness. `Fooocus` scores well on fast first-run simplicity and poorly on future-proofing because its own maintainers say it is LTS-only and not moving to new architectures ([Fooocus README](https://github.com/lllyasviel/Fooocus)).
- Do not assume a single-user desktop install and a shared self-hosted service are the same problem. Shared instances need queue control, user isolation, storage hygiene, and clearer admin boundaries. `InvokeAI` and `SwarmUI` are more explicit about that than most alternatives ([InvokeAI v6.12.0 release notes](https://github.com/invoke-ai/InvokeAI/releases/tag/v6.12.0), [SwarmUI latest release 0.9.8-Beta](https://github.com/mcmonkeyprojects/SwarmUI/releases/tag/0.9.8-Beta)).
- Do not ignore workflow export and backup. Outputs, workflow JSON, and model metadata become part of the operating system of a serious self-hosted setup, not just disposable artifacts ([ComfyUI README](https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/README.md), [selfhosting.sh guide, 2026](https://selfhosting.sh/apps/comfyui/)).

## Final Recommendation

For a fresh 2026 self-hosted AI image-generation deployment, pick `ComfyUI` unless you have a specific reason not to. It has the best mix of current-model support, release cadence, automation potential, workflow reproducibility, hardware flexibility, and practitioner momentum ([ComfyUI docs](https://docs.comfy.org/), [ComfyUI latest release v0.19.3](https://github.com/Comfy-Org/ComfyUI/releases/tag/v0.19.3), [TechTactician comparison, 2025](https://techtactician.com/comfyui-vs-automatic1111-vs-fooocus-comparison/)).

Choose `InvokeAI` instead if your environment is more creator-facing than workflow-engineering-facing. It is the better answer when polished canvas tooling, model management, and a more guided UI matter more than maximum graph flexibility ([InvokeAI docs](https://invoke.ai/), [InvokeAI v6.12.0 release notes](https://github.com/invoke-ai/InvokeAI/releases/tag/v6.12.0)).

Keep `SwarmUI` on the shortlist whenever the deployment is shared, hybrid, or community-facing. I would not rank it above `ComfyUI` yet because of the `Beta` label and smaller installed base, but it is the one most likely to overperform if your real requirement is "give normal users something approachable without giving up advanced backends" ([SwarmUI README](https://raw.githubusercontent.com/mcmonkeyprojects/SwarmUI/master/README.md), [SwarmUI latest release 0.9.8-Beta](https://github.com/mcmonkeyprojects/SwarmUI/releases/tag/0.9.8-Beta)).

Treat `AUTOMATIC1111` as a compatibility and ecosystem play, not the strongest greenfield choice. Treat `Fooocus` as a convenience play, not a strategic platform.

## Sources Reviewed

- [ComfyUI docs](https://docs.comfy.org/) - official docs, accessed 2026-04-22.
- [ComfyUI README](https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/README.md) - official maintainer README, accessed 2026-04-22.
- [ComfyUI system requirements](https://docs.comfy.org/installation/system_requirements) - official docs, accessed 2026-04-22.
- [ComfyUI latest release v0.19.3](https://github.com/Comfy-Org/ComfyUI/releases/tag/v0.19.3) - official release metadata, published 2026-04-17.
- [ComfyUI GitHub repository](https://github.com/Comfy-Org/ComfyUI) - repo metadata for stars, forks, activity, accessed 2026-04-22.
- [InvokeAI docs](https://invoke.ai/) - official docs home, accessed 2026-04-22.
- [InvokeAI README](https://raw.githubusercontent.com/invoke-ai/InvokeAI/main/README.md) - official maintainer README, accessed 2026-04-22.
- [InvokeAI installation](https://invoke.ai/start-here/installation/) - official install docs, last updated 2026-02-18.
- [InvokeAI hardware requirements](https://invoke.ai/start-here/system-requirements/) - official hardware guidance, last updated 2026-02-18.
- [InvokeAI v6.12.0 release notes](https://github.com/invoke-ai/InvokeAI/releases/tag/v6.12.0) - official release notes, published 2026-03-22.
- [InvokeAI GitHub repository](https://github.com/invoke-ai/InvokeAI) - repo metadata for stars, forks, activity, accessed 2026-04-22.
- [AUTOMATIC1111 stable-diffusion-webui](https://github.com/AUTOMATIC1111/stable-diffusion-webui) - official README and repo metadata, accessed 2026-04-22.
- [AUTOMATIC1111 latest release v1.10.1](https://github.com/AUTOMATIC1111/stable-diffusion-webui/releases/tag/v1.10.1) - official release metadata, published 2025-02-09.
- [Fooocus README](https://github.com/lllyasviel/Fooocus) - official README and repo metadata, accessed 2026-04-22.
- [Fooocus latest release v2.5.5](https://github.com/lllyasviel/Fooocus/releases/tag/v2.5.5) - official release metadata, published 2024-08-12.
- [SwarmUI README](https://raw.githubusercontent.com/mcmonkeyprojects/SwarmUI/master/README.md) - official maintainer README, accessed 2026-04-22.
- [SwarmUI latest release 0.9.8-Beta](https://github.com/mcmonkeyprojects/SwarmUI/releases/tag/0.9.8-Beta) - official release metadata, published 2026-02-06.
- [SwarmUI GitHub repository](https://github.com/mcmonkeyprojects/SwarmUI) - repo metadata for stars, forks, activity, accessed 2026-04-22.
- [ToolHalla: ComfyUI vs InvokeAI vs Fooocus 2026](https://toolhalla.ai/blog/comfyui-vs-invokeai-vs-fooocus-2026) - editorial comparison, used as supporting synthesis only.
- [TechTactician: ComfyUI vs Automatic1111 vs Fooocus](https://techtactician.com/comfyui-vs-automatic1111-vs-fooocus-comparison/) - practitioner comparison, used as supporting anecdotal evidence.
- [KeyValue: WebUI Forge Evolution From AUTOMATIC1111 to ComfyUI](https://www.keyvalue.systems/blog/webui-forge-evolution-automatic1111-to-comfyui-stable-diffusion/) - engineering case study, used as practitioner evidence.
- [selfhosting.sh ComfyUI guide](https://selfhosting.sh/apps/comfyui/) - operational self-hosting guide, used for deployment cautions and best practices.
