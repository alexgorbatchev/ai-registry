---
name: rapid-demo
description: >-
  REQUIRED for building rapid working local demos, full-stack prototypes, or practice problem APIs with parallel subagent review. Trigger whenever asked to build a quick demo, prototype, or practice problem.
author: alexgorbatchev
metadata:
  created_on: 2026-08-20 14:15
  last_modified: 2026-08-20 14:25
  status: current
---

## Core Execution & Subagent Strategy

When executing a rapid local demo or practice problem under tight time constraints:

1. **Role Division & Single-Editor Rule**:
   - The parent orchestrator is the **lead and only file editor**.
   - Do NOT let subagents modify files directly to avoid write conflicts.

2. **Parallel Subagent Review Wave**:
   - **Subagent 1 (Cases Agent)**: At start, spawn a read-only `reviewer` subagent in parallel to analyze requirements and output at most 6 critical acceptance and edge cases.
   - **Subagent 2 (Test & Black-Box Checker)**: As soon as the application is runnable, spawn a second read-only `reviewer` subagent to execute `bun test` and black-box HTTP requests, reporting **only blocking failures**.

3. **Time-Boxed Cadence**:
   - Stop feature work after 15 minutes.
   - Spend the final 5 minutes running end-to-end verification and fixing bugs.
   - Take every shortcut possible to achieve a fully functional, working demo on time.

---

## Technical Stack & Architecture Standards

- **Runtime & Database**: Bun + TypeScript + `bun:sqlite` using native `Bun.serve()`.
- **Dual Surface**: Expose BOTH JSON REST API (`/api/...`) AND a server-rendered Web UI (`/` and `/ui/...`).
- **Zero Client-Side JavaScript**:
  - The Web UI MUST NOT contain any `<script>` tags or client-side JavaScript execution.
  - All UI state transitions and mutations MUST use native HTML forms (`<form method="GET">` for searching, `<form method="POST">` for mutations).
  - Mutations handle form submissions (`application/x-www-form-urlencoded`) and return `302 Found` redirects back to `/` with query parameter flash messages (`?message=...` or `?error=...`).
- **Layout & CSS Styling Design System**:
  - Follow the canonical CSS design tokens, card grid layout, status badges, forms, and table styles in [references/html-styling.md](references/html-styling.md).
  - Main container styling must use `width: 90%; max-width: 1800px; margin: 0 auto;` for wide screen visibility.
- **Datetime Local Normalization**:
  - HTML `datetime-local` inputs format dates as `YYYY-MM-DDTHH:mm` without a timezone.
  - Always append `:00.000Z` BEFORE calling `new Date()` so dates parse in UTC across all browser timezones without offset distortion.
- **Immediate Default Render**:
  - Auto-run default search queries on initial GET `/` page load so users see populated data immediately upon opening the page.

---

## CLI & Verification Pipeline

1. **Package Scripts (`package.json`)**:
   - Include `"dev": "bun --watch src/index.ts"` for hot reloading.
   - Include `"start": "bun src/index.ts"` and `"test": "bun test"`.

2. **End-to-End Verification (`verify.ts`)**:
   - Create a standalone verification script (`verify.ts`) that boots the server on port 0, executes `fetch()` calls against Web UI forms and REST endpoints, and asserts that 0 `<script>` tags exist in returned HTML.

3. **Final Delivery Format**:
   - Provide start and test commands.
   - State a 1-10 completion score explaining the score and any known gaps.
