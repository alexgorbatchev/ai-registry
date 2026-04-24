---
created_on: 2026-04-23 13:13
author: openai/gpt-5.4
source_url: multiple, see Sources Reviewed
---

# Self-Hosted AI Audio Generation and Voice Cloning on MacBook Pro M1 Max
Created: 2026-04-23
Last updated: 2026-04-23

## Original Prompt
> ai audio generated selfhosted tooling i can run on macbook pro m1 max, specifically interested in generating songs and voice cloning applications.

## Executive Summary

The short version is that **voice cloning is materially more mature on an M1 Max than full song generation with vocals**. The strongest local voice-cloning paths are `F5-TTS` via `f5-tts-mlx` for Apple-native simplicity and `GPT-SoVITS` for a fuller WebUI/workbench experience, while the strongest local song-generation path is currently `ACE-Step`, with `DiffRhythm` as the next most credible full-song experiment. [Prescriptive] ([F5-TTS](https://github.com/SWivid/F5-TTS), [f5-tts-mlx](https://github.com/lucasnewman/f5-tts-mlx), [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS), [ACE-Step](https://github.com/ace-step/ACE-Step), [DiffRhythm](https://github.com/ASLP-lab/DiffRhythm))

The main reason the answer splits this way is platform fit. Apple Silicon has solid framework-level acceleration through PyTorch MPS and excellent hardware alignment through MLX, but many audio projects still document CUDA-first installs, CUDA-only optimizations, or only weakly tested macOS support. [Fact] ([PyTorch MPS docs](https://docs.pytorch.org/docs/stable/notes/mps.html), [MLX README](https://github.com/ml-explore/mlx))

For **songs**, `ACE-Step` stands out because it explicitly documents macOS support, includes a published `MacBook M2 Max` throughput table, and exposes music-specific workflows like text-to-music, lyric editing, extension, repainting, and lyric-to-vocal style generation. `DiffRhythm` also explicitly says it now runs on macOS and targets full-length songs, but its Apple evidence is thinner and less benchmarked. [Fact][Benchmarked] ([ACE-Step](https://github.com/ace-step/ACE-Step), [DiffRhythm](https://github.com/ASLP-lab/DiffRhythm))

For **voice cloning**, `F5-TTS` is the best Apple-hardware match once you use the MLX implementation, but its shipped pretrained models are non-commercial (`CC-BY-NC`). `GPT-SoVITS` has the strongest first-party Apple Silicon install story among full voice-cloning stacks, but it is heavier and its own README says Mac-based training currently produces lower quality than other devices. [Fact][Prescriptive] ([F5-TTS](https://github.com/SWivid/F5-TTS), [f5-tts-mlx](https://github.com/lucasnewman/f5-tts-mlx), [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS))

Several popular names are worse fits than their hype suggests. `MusicGen` and `Stable Audio Open` are valid local audio tools, but both official model cards explicitly say they are not good at realistic vocals, which matters a lot if “songs” means sung songs rather than instrumental sketches. `Coqui XTTS v2` is strong on paper, but its Apple MPS issue history is poor enough that it should not be the first recommendation for an M1 Max. [Fact][Prescriptive] ([MusicGen model card](https://huggingface.co/facebook/musicgen-small), [Stable Audio Open model card](https://huggingface.co/stabilityai/stable-audio-open-1.0), [Coqui XTTS docs](https://docs.coqui.ai/en/latest/models/xtts.html), [Coqui issue #3649](https://github.com/coqui-ai/TTS/issues/3649))

## Short Answer or Recommendation

If you want the **best local song-generation bet on an M1 Max**, start with `ACE-Step`. If you want a second experiment for full songs, try `DiffRhythm`. If you mainly want **instrumental idea sketching** on Apple hardware rather than convincing vocals, try `musicgen-mlx`. [Prescriptive] ([ACE-Step](https://github.com/ace-step/ACE-Step), [DiffRhythm](https://github.com/ASLP-lab/DiffRhythm), [musicgen-mlx](https://github.com/andrade0/musicgen-mlx))

If you want the **best local voice-cloning path**, start with `f5-tts-mlx` if non-commercial weights are acceptable. If you want the **best officially documented Apple-Silicon cloning stack with a fuller UI/workbench**, start with `GPT-SoVITS`. If you actually need **TTS more than cloning**, `Kokoro` is the cleanest Apple-friendly TTS choice in this set. [Prescriptive] ([f5-tts-mlx](https://github.com/lucasnewman/f5-tts-mlx), [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS), [Kokoro](https://github.com/hexgrad/kokoro))

If your real requirement is **commercial deployment**, be stricter than the benchmark rankings. In that case, `F5-TTS` drops because the pretrained models are `CC-BY-NC`, `Piper` becomes trickier because of `GPL-3.0`, and permissive options such as `Kokoro`, `MeloTTS`, `OpenVoice`, and likely selected `GPT-SoVITS` checkpoints become more attractive, subject to checkpoint-by-checkpoint license review. [Fact][Prescriptive] ([F5-TTS](https://github.com/SWivid/F5-TTS), [Kokoro](https://github.com/hexgrad/kokoro), [MeloTTS](https://github.com/myshell-ai/MeloTTS), [OpenVoice](https://github.com/myshell-ai/OpenVoice), [Piper](https://github.com/OHF-Voice/piper1-gpl))

## Rating System

### Claim-type legend

- **[Fact]** = directly documented in upstream docs, model cards, or issue trackers.
- **[Benchmarked]** = published timing, hardware, or throughput numbers.
- **[Anecdotal]** = practitioner videos, issue comments, or informal reports.
- **[Prescriptive]** = my recommendation based on the evidence mix above.

### 1-10 scoring rubric

Each score is a weighted composite:

- **Task fit (30%)**: how well it does the exact job requested: songs with vocals, or voice cloning.  
- **Apple Silicon fit (30%)**: how credible the M1 Max path is, including explicit MPS/MLX/macOS support.  
- **Setup friction (15%)**: how likely it is to install and run without heroic debugging.  
- **Maturity and maintenance (15%)**: repo activity, official support clarity, and ecosystem confidence.  
- **Licensing and commercial usability (10%)**: whether the code and weights are workable beyond hobby use.  

Interpretation:

- **9-10**: unusually strong fit; recommended by default.
- **7-8**: good fit with clear caveats.
- **5-6**: workable but materially compromised.
- **3-4**: niche or experimental on this hardware.
- **1-2**: poor fit; do not start here.

## Compared Approaches or Options

### Song generation on MacBook Pro M1 Max

| Option | Score | Why it ranks here | Evidence type |
|---|---:|---|---|
| `ACE-Step` | **8.4/10** | Best overall fit because the official repo explicitly says the GUI works on macOS, includes a `MacBook M2 Max` benchmark, and targets long-form music workflows rather than short audio clips. | [Fact][Benchmarked][Prescriptive] |
| `DiffRhythm` | **7.5/10** | Credible full-song option with explicit macOS support language, but weaker Apple-specific benchmark depth than `ACE-Step`. | [Fact][Prescriptive] |
| `musicgen-mlx` | **7.0/10** | Best Apple-native instrumental sketching path, but it is a small community port and inherits `MusicGen`’s weak-vocals limitation. | [Fact][Prescriptive] |
| `MusicGen` official stack | **6.4/10** | Strong and popular for local text-to-music, but the official model card says vocals are not realistic and Apple support is less first-class than MLX-native ports. | [Fact][Prescriptive] |
| `Stable Audio Open` | **5.8/10** | Real local option with MPS support now landed, but the model card itself says it is better at sound effects and field recordings than music and does not generate realistic vocals. | [Fact][Benchmarked][Prescriptive] |
| `Riffusion` | **4.6/10** | Mac-feasible for short clips, but unmaintained and not a serious 2026 full-song recommendation. | [Fact][Prescriptive] |
| `YuE` | **3.2/10** | Very interesting capability-wise, but the official docs are explicitly CUDA/FlashAttention/large-GPU oriented, which makes it a bad first local-Mac bet. | [Fact][Anecdotal][Prescriptive] |

#### `ACE-Step`

`ACE-Step` is the strongest song-generation recommendation because its official README explicitly says the GUI works on macOS, gives a macOS-specific `--bf16 false` workaround, and publishes `MacBook M2 Max` throughput numbers instead of only CUDA benchmarks. [Fact][Benchmarked] ([ACE-Step](https://github.com/ace-step/ACE-Step))

Its capability surface is also unusually aligned with the prompt: text-to-music, lyric editing, repainting, extension, audio-to-audio, and lyric-to-vocal style generation are all first-class features rather than side effects. [Fact] ([ACE-Step](https://github.com/ace-step/ACE-Step))

The caveat is that the published Apple benchmark is for `M2 Max`, not `M1 Max`, and several memory-saving notes in the repo are clearly written from a CUDA/VRAM mindset rather than Apple unified memory. [Fact][Prescriptive] ([ACE-Step](https://github.com/ace-step/ACE-Step), [MLX README](https://github.com/ml-explore/mlx))

#### `DiffRhythm`

`DiffRhythm` deserves second place because it is explicitly built for full-length songs and its README directly says the project can now run on macOS. [Fact] ([DiffRhythm](https://github.com/ASLP-lab/DiffRhythm))

The repo also documents a macOS dependency step (`brew install espeak-ng`) and claims the base model can fit a minimum `8G VRAM` requirement with `--chunked`, which at least suggests it is not assuming datacenter GPUs for basic inference. [Fact] ([DiffRhythm](https://github.com/ASLP-lab/DiffRhythm))

The reason it still ranks below `ACE-Step` is evidence quality: I found explicit Mac support language, but not the same quality of Apple-hardware benchmark table. [Prescriptive]

#### `musicgen-mlx` and official `MusicGen`

`MusicGen` remains one of the easiest open-source text-to-music families to understand and run locally through Transformers or AudioCraft, but the official model card explicitly warns that it does **not** generate realistic vocals. That sharply limits its value if you mean “songs” as sung songs rather than instrumental demos. [Fact] ([MusicGen model card](https://huggingface.co/facebook/musicgen-small), [AudioCraft README](https://github.com/facebookresearch/audiocraft))

`musicgen-mlx` improves the hardware fit because it is explicitly built for Apple Silicon on top of MLX, but it is still an early community project, does not yet support `musicgen-melody`, and does not solve the core upstream vocal-quality limitation. [Fact][Prescriptive] ([musicgen-mlx](https://github.com/andrade0/musicgen-mlx), [MLX README](https://github.com/ml-explore/mlx), [MusicGen model card](https://huggingface.co/facebook/musicgen-small))

#### `Stable Audio Open`, `Riffusion`, and `YuE`

`Stable Audio Open` is worth knowing about because official MPS support landed in `stable-audio-tools`, and an M2 Max user reported materially faster performance on MPS than CPU in the related pull request discussion. [Fact][Benchmarked][Anecdotal] ([Stable Audio Open model card](https://huggingface.co/stabilityai/stable-audio-open-1.0), [stable-audio-tools PR #82](https://github.com/Stability-AI/stable-audio-tools/pull/82))

It still ranks low for this prompt because Stability’s own model card says the model is better at sound effects and field recordings than music and is not able to generate realistic vocals. [Fact] ([Stable Audio Open model card](https://huggingface.co/stabilityai/stable-audio-open-1.0))

`Riffusion` supports `mps`, but the project itself says it is no longer actively maintained, which is a bad fit for a serious production-leaning decision. [Fact][Prescriptive] ([Riffusion hobby](https://github.com/riffusion/riffusion-hobby))

`YuE` is the clearest example of a tool that looks exciting in demos but is not the right local-Mac starting point. Its official README requires `CUDA >= 11.8`, says `FlashAttention 2` is mandatory, and discusses much larger GPU footprints for richer workloads. A practitioner install video also used an `H100 80GB` GPU and reported roughly ten minutes to generate about one minute of audio, which reinforces the “not a laptop-first path” conclusion. [Fact][Anecdotal][Prescriptive] ([YuE README](https://github.com/multimodal-art-projection/YuE), [YuE practitioner video](https://www.youtube.com/watch?v=RSMNH9GitbA))

### Voice cloning and TTS on MacBook Pro M1 Max

| Option | Score | Why it ranks here | Evidence type |
|---|---:|---|---|
| `F5-TTS` via `f5-tts-mlx` | **8.6/10** | Best Apple-hardware match for cloning, with fast MLX inference evidence, but limited by non-commercial pretrained weights. | [Fact][Benchmarked][Prescriptive] |
| `GPT-SoVITS` | **8.1/10** | Strongest officially documented Apple-Silicon cloning stack, with explicit macOS install and tested Apple-silicon environments. | [Fact][Prescriptive] |
| `Kokoro` | **7.8/10** | Best pure local TTS option here, but not a voice-cloning tool. | [Fact][Prescriptive] |
| `MeloTTS` | **7.3/10** | Good multilingual TTS with documented macOS/MPS use, but again not real voice cloning. | [Fact][Prescriptive] |
| `OpenVoice V2` | **6.3/10** | Attractive cloning features and permissive licensing, but official docs treat non-Linux installs as unofficial. | [Fact][Prescriptive] |
| `Piper` | **6.1/10** | Very practical offline TTS engine, but not voice cloning and carries GPL implications. | [Fact][Prescriptive] |
| `Coqui XTTS v2` | **4.7/10** | Strong feature story on paper, but weak Apple MPS reality, including a closed `wontfix` issue for `xtts_v2` on Apple Silicon. | [Fact][Prescriptive] |

#### `F5-TTS` via `f5-tts-mlx`

`F5-TTS` is one of the best current open voice-matching systems, and its upstream README explicitly includes an Apple Silicon install path. The better reason to choose it on an M1 Max, though, is the separate MLX implementation, which is explicitly Apple-focused and reports a sample generated in about four seconds on an `M3 Max`. [Fact][Benchmarked][Prescriptive] ([F5-TTS](https://github.com/SWivid/F5-TTS), [f5-tts-mlx](https://github.com/lucasnewman/f5-tts-mlx))

The major caveat is licensing: the code is `MIT`, but the pretrained models are `CC-BY-NC`, which is a real blocker for many commercial uses. [Fact] ([F5-TTS](https://github.com/SWivid/F5-TTS))

#### `GPT-SoVITS`

`GPT-SoVITS` has the strongest first-party Apple-Silicon support story among the richer cloning stacks I reviewed. Its README lists tested Apple Silicon environments and provides a macOS install flow with `bash install.sh --device <MPS|CPU>`. [Fact] ([GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS))

It also covers the workflows people usually mean by “voice cloning”: zero-shot cloning from a five-second sample, few-shot adaptation from about a minute, cross-lingual support, and a WebUI. [Fact] ([GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS))

The tradeoff is complexity. It is heavier than `f5-tts-mlx`, and the upstream README explicitly says models trained on Macs currently produce significantly lower quality than models trained on other devices, so Mac is better treated as an inference box than a serious training box. [Fact][Prescriptive] ([GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS))

#### `Kokoro`, `MeloTTS`, and `Piper`

`Kokoro` is not voice cloning, but it is a very good answer if you actually need fast, high-quality local TTS with a cleaner commercial story. Its README explicitly includes `MacOS Apple Silicon GPU Acceleration` guidance, and the repo presents Apache-licensed weights. [Fact][Prescriptive] ([Kokoro](https://github.com/hexgrad/kokoro))

`MeloTTS` is similarly useful if you want multilingual TTS rather than cloning. Its docs explicitly support Linux/macOS installs, allow `mps` as a device, and say CPU can be sufficient for real-time inference. [Fact] ([MeloTTS](https://github.com/myshell-ai/MeloTTS), [MeloTTS install docs](https://github.com/myshell-ai/MeloTTS/blob/main/docs/install.md))

`Piper` remains a practical offline TTS engine, but it is better thought of as a fast local speech engine than a frontier voice-cloning stack, and its `GPL-3.0` license can matter if you plan to distribute software around it. [Fact][Prescriptive] ([Piper](https://github.com/OHF-Voice/piper1-gpl))

#### `OpenVoice V2` and `Coqui XTTS v2`

`OpenVoice V2` is capability-rich on paper: instant voice cloning, style control, and cross-lingual use. The reason it does not rank higher is that the official usage docs frame Linux as the developer path and explicitly relegate other platforms to unofficial/community guidance. There is also an unresolved Apple M1 issue in the repo. [Fact][Prescriptive] ([OpenVoice](https://github.com/myshell-ai/OpenVoice), [OpenVoice usage docs](https://github.com/myshell-ai/OpenVoice/blob/main/docs/USAGE.md), [OpenVoice issue #18](https://github.com/myshell-ai/OpenVoice/issues/18))

`Coqui XTTS v2` is the main “looks better on paper than on an M1 Max” warning. The official docs advertise strong cloning features, including cross-language cloning and low-latency streaming, but the docs are CUDA-centric and a reported `xtts_v2` MPS failure on Apple Silicon was closed as `wontfix`. [Fact][Prescriptive] ([XTTS docs](https://docs.coqui.ai/en/latest/models/xtts.html), [Coqui issue #3649](https://github.com/coqui-ai/TTS/issues/3649))

## Common Patterns and Best Practices

Prefer **MLX-native** ports on Apple Silicon when they exist. Apple’s own MLX project is designed for unified memory and Apple Silicon execution, so MLX ports often map better to an M1 Max than generic PyTorch MPS paths. [Fact][Prescriptive] ([MLX README](https://github.com/ml-explore/mlx), [f5-tts-mlx](https://github.com/lucasnewman/f5-tts-mlx), [musicgen-mlx](https://github.com/andrade0/musicgen-mlx))

Treat **PyTorch MPS support as necessary but not sufficient**. The MPS backend is real, but it only proves framework-level acceleration exists; it does not prove a specific model avoids unsupported ops, CPU fallbacks, or poor kernels. Several projects in this review explicitly depend on fallbacks or have Apple-specific issues. [Fact][Prescriptive] ([PyTorch MPS docs](https://docs.pytorch.org/docs/stable/notes/mps.html), [Riffusion hobby](https://github.com/riffusion/riffusion-hobby), [Coqui issue #3649](https://github.com/coqui-ai/TTS/issues/3649))

Separate **voice cloning**, **TTS**, and **song generation with vocals** in your decision. Those are adjacent but not equivalent tasks, and several tools that look strong in one column are weak or irrelevant in another. `Kokoro`, `MeloTTS`, and `Piper` are good TTS tools but not cloning tools; `MusicGen` is useful for instrumental generation but officially weak at realistic vocals. [Fact][Prescriptive] ([Kokoro](https://github.com/hexgrad/kokoro), [MeloTTS](https://github.com/myshell-ai/MeloTTS), [Piper](https://github.com/OHF-Voice/piper1-gpl), [MusicGen model card](https://huggingface.co/facebook/musicgen-small))

Check the **weights license**, not just the repo license. `MIT` or `Apache-2.0` code does not automatically mean the shipped checkpoints are commercially usable. `F5-TTS` is the cleanest example here. [Fact][Prescriptive] ([F5-TTS](https://github.com/SWivid/F5-TTS), [Kokoro](https://github.com/hexgrad/kokoro))

## Disagreements or Tensions

The biggest tension in this space is that **capability demos often outrun platform reality**. Many repos advertise state-of-the-art generation quality, but their actual install and benchmark sections are still CUDA-first. That is why `YuE`, `SongGen`, and some stock AudioCraft paths remain strategically interesting yet practically weaker for an M1 Max. [Fact][Prescriptive] ([YuE README](https://github.com/multimodal-art-projection/YuE), [SongGen](https://github.com/LiuZH-19/SongGen), [AudioCraft README](https://github.com/facebookresearch/audiocraft))

There is also a recurring tension between **official support** and **community Apple ports**. `musicgen-mlx` and `f5-tts-mlx` are not the canonical upstream implementations, but they may still be the right answer for Apple hardware because they align better with MLX and unified memory. [Fact][Prescriptive] ([musicgen-mlx](https://github.com/andrade0/musicgen-mlx), [f5-tts-mlx](https://github.com/lucasnewman/f5-tts-mlx), [MLX README](https://github.com/ml-explore/mlx))

Finally, there is a tension between **best capability** and **best license**. The strongest technical option is not always the strongest commercial option, especially in voice cloning. [Fact][Prescriptive] ([F5-TTS](https://github.com/SWivid/F5-TTS), [OpenVoice](https://github.com/myshell-ai/OpenVoice), [Kokoro](https://github.com/hexgrad/kokoro))

## Risks and Anti-patterns

Do not choose a tool just because it says “runs on macOS.” In this category, that often means “starts with MPS fallback and patience,” not “pleasant daily workflow.” [Prescriptive] ([PyTorch MPS docs](https://docs.pytorch.org/docs/stable/notes/mps.html), [Riffusion hobby](https://github.com/riffusion/riffusion-hobby))

Do not treat **YouTube demos** as performance proof. They are useful as anecdotal signals, but they often hide hardware, setup tuning, and failure rate. In this review I only used video material as weak supporting evidence, not as primary proof. [Anecdotal][Prescriptive] ([YuE practitioner video](https://www.youtube.com/watch?v=RSMNH9GitbA), [XTTS practitioner video](https://www.youtube.com/watch?v=8tpDiiouGxc))

Do not assume a tool that is good at **TTS** is automatically good at **voice cloning**, or that a tool that is good at **music generation** is automatically good at **vocals**. This is the most common category mistake in current open audio tooling. [Prescriptive] ([MusicGen model card](https://huggingface.co/facebook/musicgen-small), [Kokoro](https://github.com/hexgrad/kokoro), [XTTS docs](https://docs.coqui.ai/en/latest/models/xtts.html))

## Final Recommendation

If you want one practical plan for a **MacBook Pro M1 Max**, I would use a two-track setup. [Prescriptive]

1. **Songs:** start with `ACE-Step`; keep `DiffRhythm` as the second experiment; use `musicgen-mlx` only if your real goal is instrumental idea generation rather than convincing vocals. [Prescriptive] ([ACE-Step](https://github.com/ace-step/ACE-Step), [DiffRhythm](https://github.com/ASLP-lab/DiffRhythm), [musicgen-mlx](https://github.com/andrade0/musicgen-mlx), [MusicGen model card](https://huggingface.co/facebook/musicgen-small))
2. **Voice cloning:** start with `f5-tts-mlx` if non-commercial use is acceptable and you want the smoothest Apple-native path; otherwise start with `GPT-SoVITS` if you want broader workflow coverage and stronger first-party macOS evidence. [Prescriptive] ([f5-tts-mlx](https://github.com/lucasnewman/f5-tts-mlx), [F5-TTS](https://github.com/SWivid/F5-TTS), [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS))
3. **Pure local TTS:** use `Kokoro` first, then `MeloTTS`, then `Piper` if you mainly care about an offline speech engine. [Prescriptive] ([Kokoro](https://github.com/hexgrad/kokoro), [MeloTTS](https://github.com/myshell-ai/MeloTTS), [Piper](https://github.com/OHF-Voice/piper1-gpl))

The skeptical bottom line is this: **full local song generation with vocals on an M1 Max is possible, but still rougher and less settled than local voice cloning or TTS**. If you need the least frustrating path today, optimize for voice cloning first and treat song generation as a more experimental second track. [Prescriptive] ([ACE-Step](https://github.com/ace-step/ACE-Step), [DiffRhythm](https://github.com/ASLP-lab/DiffRhythm), [f5-tts-mlx](https://github.com/lucasnewman/f5-tts-mlx), [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS))

## Sources Reviewed

- [AudioCraft README](https://github.com/facebookresearch/audiocraft)
- [MusicGen model card](https://huggingface.co/facebook/musicgen-small)
- [ACE-Step README](https://github.com/ace-step/ACE-Step)
- [DiffRhythm README](https://github.com/ASLP-lab/DiffRhythm)
- [Riffusion hobby README](https://github.com/riffusion/riffusion-hobby)
- [Stable Audio Open 1.0 model card](https://huggingface.co/stabilityai/stable-audio-open-1.0)
- [stable-audio-tools PR #82 (MPS support)](https://github.com/Stability-AI/stable-audio-tools/pull/82)
- [MLX README](https://github.com/ml-explore/mlx)
- [musicgen-mlx README](https://github.com/andrade0/musicgen-mlx)
- [YuE README](https://github.com/multimodal-art-projection/YuE)
- [YuE practitioner install/demo video](https://www.youtube.com/watch?v=RSMNH9GitbA)
- [Coqui TTS README](https://github.com/coqui-ai/TTS)
- [XTTS v2 docs](https://docs.coqui.ai/en/latest/models/xtts.html)
- [Coqui issue #3649: xtts_v2 with MPS on Apple Silicon](https://github.com/coqui-ai/TTS/issues/3649)
- [F5-TTS README](https://github.com/SWivid/F5-TTS)
- [f5-tts-mlx README](https://github.com/lucasnewman/f5-tts-mlx)
- [GPT-SoVITS README](https://github.com/RVC-Boss/GPT-SoVITS)
- [Kokoro README](https://github.com/hexgrad/kokoro)
- [MeloTTS README](https://github.com/myshell-ai/MeloTTS)
- [MeloTTS install docs](https://github.com/myshell-ai/MeloTTS/blob/main/docs/install.md)
- [OpenVoice README](https://github.com/myshell-ai/OpenVoice)
- [OpenVoice usage docs](https://github.com/myshell-ai/OpenVoice/blob/main/docs/USAGE.md)
- [OpenVoice issue #18](https://github.com/myshell-ai/OpenVoice/issues/18)
- [PyTorch MPS backend docs](https://docs.pytorch.org/docs/stable/notes/mps.html)
- [SongGen README](https://github.com/LiuZH-19/SongGen)
- [Piper repository](https://github.com/OHF-Voice/piper1-gpl)
- [XTTS practitioner fine-tuning video](https://www.youtube.com/watch?v=8tpDiiouGxc)
