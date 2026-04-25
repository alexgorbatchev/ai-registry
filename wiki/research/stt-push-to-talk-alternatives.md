---
created_on: 2026-04-01 11:44
author: openai/gpt-5.4
tags:
  - research
  - speech-to-text
  - push-to-talk
  - macos
  - deepgram
---

# STT Push-to-Talk Alternatives

A shortlist of GitHub tools similar to Wispr Flow that use the Deepgram API for push-to-talk on macOS and appear active/maintained.

## Best matches

### 1. [kstonekuan/tambourine-voice](https://github.com/kstonekuan/tambourine-voice)
**Closest to Wispr Flow feature-wise**

- Explicitly positions itself as an **open-source alternative to Wispr Flow**
- **macOS supported**
- **Hold-to-record** and **toggle** hotkeys
- Supports **Deepgram** as an STT provider
- Very active:
  - last commit: **2026-04-01**
  - stars: **323**
- Caveat: this is a **Tauri app + separate Python server**, not a tiny standalone native app

**Best if:** you want the most Wispr-like feature set, not the smallest install.

---

### 2. [KLIEBHAN/pulsescribe](https://github.com/KLIEBHAN/pulsescribe)
**Strong Wispr-style UX, Deepgram-first option**

- README says: **“Voice input for macOS and Windows – inspired by Wispr Flow”**
- **macOS supported**
- **Push-to-talk** (`Fn`) and **toggle** hotkeys
- **Deepgram recommended**, with claimed **~300ms latency**
- Also has overlay, context awareness, and optional LLM cleanup
- Active:
  - last commit: **2026-03-28**
  - latest release: **v1.2.0** on **2025-12-27**
  - license: **MIT**

**Best if:** you want a practical Deepgram-based app that is closer to a finished desktop product.

---

### 3. [sumerc/zee](https://github.com/sumerc/zee)
**Best lightweight macOS menu-bar option**

- **macOS menu bar** app
- **Push-to-talk**, **tap-to-toggle**, and **real-time streaming**
- Deepgram support is explicit: `DEEPGRAM_API_KEY` and WebSocket streaming
- Active:
  - last commit: **2026-04-01**
  - latest release: **v0.3.5** on **2026-03-16**
  - stars: **13**

**Best if:** you want a simpler, fast, hackable menu-bar tool rather than a full Wispr clone.

---

### 4. [evoleinik/fnkey](https://github.com/evoleinik/fnkey)
**Minimalist Deepgram push-to-talk for macOS**

- Tiny **macOS menu bar** app
- Hold **Fn**, speak, release, paste
- README explicitly says **Deepgram streaming is recommended**
- Active:
  - last commit: **2026-03-23**
  - latest release: **v0.5.0** on **2026-03-23**
  - stars: **45**
- More minimal than Wispr Flow; less product surface

**Best if:** you want the narrowest “hold key, dictate, paste” workflow.

## Rankings

### Closest to Wispr Flow
1. **Tambourine**
2. **PulseScribe**
3. **Zee**
4. **FnKey**

### Best if you specifically want Deepgram + push-to-talk + macOS with the least fuss
1. **FnKey**
2. **Zee**
3. **PulseScribe**
4. **Tambourine**

## Excluded on purpose

Not included:

- **open-wispr**
- **freeflow**
- **typewhisper-mac**
- similar repos built primarily around **Whisper/local transcription** rather than **Deepgram**

## Due diligence notes

- **Zee** appears to have **no explicit OSS license** in repo metadata. If reuse/modification rights matter, that is a real issue.
- **Zee README** also appears to have a docs mismatch: one example shows `OPENAI_API_KEY=xxx zee -stream` while the same README says streaming is **Deepgram**-based. Treat the `DEEPGRAM_API_KEY` path as authoritative.
- **Tambourine** is the most Wispr-like, but it is **not the simplest install**: it uses a **desktop app plus local Python server** and is **AGPL-3.0**.
- The market is still thin here: **most active macOS dictation repos are local Whisper apps**, not Deepgram-native tools.
