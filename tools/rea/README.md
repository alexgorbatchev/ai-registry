# REA

Shared [REA](https://github.com/morluto/rea) MCP configuration for Codex, Claude Code, Pi, OpenCode, and Antigravity. Run `just build` and `just bootstrap` from the registry root to apply it to the current machine. Restart existing agent sessions to load the server and workflow.

All five harnesses launch `bun x rea-agents@6.10.1 mcp`. Bun manages package retrieval; the package runs under Node. REA requires Node 22.23.4+, 24.22.1+, or 26.12.1+ in its supported release lines. Bun's runtime is not supported by this release. Keep the version aligned across these configuration files when upgrading.

The generic workflow is vendored separately at `skills/agent/reverse-engineer-anything` and tracked by the registry's `skills-lock.json`. It comes from upstream tag `rea-agents-6.10.1`, commit `8bb01b514ac766c0c3ecc8f362bd38186eaec9c2`, under the upstream MIT license. Update it through the registry's external-skill workflow alongside the package pin.

The configuration has no project paths or required native engines. Native providers need their own supported installations; Codex forwards `GHIDRA_INSTALL_DIR` and `JAVA_HOME` when present, and the other clients inherit their launch environment. REA 6.10.1 requires Ghidra 12.2 or newer within the supported 12.x line for its Ghidra provider. A connected MCP server alone does not establish native-provider readiness.

Removing this directory removes its MCP entries on the next build and bootstrap. Remove the separately vendored workflow and lock entry as well when retiring REA completely.
