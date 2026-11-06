---
description: Audit and refresh all root and nested AGENTS.md files based on the latest docs-writer skill guidelines and current codebase reality.
---

Refresh every `AGENTS.md` file in the current repository using the `docs-writer` skill. The skill and the references it names are the only source of AGENTS.md policy for this task; this command defines only its scope.

1. Read `<%- skills_dir %>/agent/docs-writer/SKILL.md` and follow its AGENTS.md section, including every reference and template that section names.
2. Discover the files in scope: the root `AGENTS.md`, every nested `AGENTS.md`, and legacy `AGENT.md` or `agents.md` files.
3. Treat the request as a cleanup and conformance request for every discovered file. Audit, rewrite, verify, and report each file as the skill directs.
4. Run the checks the repository's own instructions require for the changed files.
