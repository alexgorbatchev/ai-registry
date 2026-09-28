# Library & Service README Variant

Read `readme.md` first. This file covers only what differs for a library, package, service, or application consumed through code rather than a terminal. Copy-pasteable template: `../assets/readme-library-template.md`.

---

## Formatting

`# What It Does` is a bulleted list. `# How It Works` and `# How it Really Works` may be bulleted or short numbered steps, whichever reads better for the flow being described; keep the two consistent with each other.

---

## `# How it Really Works` For A Library

Cover what the consumer can observe from inside their own program: what the library does on the network or filesystem, what it holds in memory or caches between calls, whether it is safe to use concurrently, whether calls block or are asynchronous, what it throws or returns on failure, what it reads from the environment, and what it does at import time versus call time. Peer dependencies and the platform or runtime versions it actually supports belong here too.

---

## `# Prerequisites`

Bulleted list of runtime requirements the consumer must already have — language runtime with a minimum version, peer dependencies, a database or service the library expects to reach, credentials it reads from the environment. Omit the section when the package manager handles everything.

---

## `# Installation`

The package manager command for the project's ecosystem, as a single copy-pasteable line. Show the one canonical manager first; add alternatives only when the project genuinely supports them. Never tell consumers to clone the repository — that is contributor documentation.

---

## `# Quick Start`

The smallest complete working example in the target language: import, construct, call, and show the result. It must run as written against a default installation. Follow it with one or two further examples only when they show a materially different use, and label each with what it demonstrates.

---

## `# API` and `# Configuration`

Replace the CLI's `# Options & Flags` with whichever of these the project needs.

`# API` documents the public surface. For a small surface, use a table:

```markdown
| Export | Signature | Description |
| :--- | :--- | :--- |
| `createClient` | `(options: ClientOptions) => Client` | Creates a client bound to one workspace |
```

For a larger surface, list each export as a `###` subsection with its signature, parameters, return value, and what it throws. Do not transcribe every type — link to generated API docs when they exist and document the entry points a consumer actually calls.

`# Configuration` documents options and environment variables in the same table shape as the CLI variant:

```markdown
| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `timeout` | `number` | `30000` | Milliseconds before a request is abandoned |
| `MYLIB_API_KEY` | env | none | Credential read at client construction |
```

---

## `# Compatibility` (Optional)

Include when consumers need it: supported runtime versions, supported platforms, the project's versioning policy, and what a major version bump means for them. Keep it factual and current — this is not a migration guide or a changelog.
