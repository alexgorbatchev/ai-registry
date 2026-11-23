# REA

Shared, opt-in [REA](https://github.com/morluto/rea) for Codex, Claude Code, Pi, OpenCode, and Antigravity. Run `just build` and `just bootstrap` from the registry root to apply it to the current machine. REA stays off during ordinary launches; existing REA-enabled sessions must be closed or restarted to release their server. No project installation is required.

Each harness receives a small `use-rea` skill with its native activation procedure:

| Harness | Activation | Lifetime |
| --- | --- | --- |
| Codex | `codex -c 'mcp_servers.rea.enabled=true'` | That invocation |
| Claude Code | `claude --mcp-config .output/claude-code/skills/use-rea/assets/mcp.json` (path relative to registry root) | That invocation |
| Pi | `pi -e .output/pi/skills/use-rea/scripts/enableRea.ts` (path relative to registry root) | That invocation; requires the session MCP API in Pi 1.6 |
| OpenCode | Connect `rea` in the MCP panel (`/mcps` in current OpenCode, `/mcp` in V1) | Running connection; disconnect when finished |
| Antigravity | `agy mcp enable rea`, start the intended session, then restore `agy mcp disable rea` | Global until disabled again |

The generated skills contain absolute registry-managed asset paths so they work from any project. Pi's extension is loaded explicitly, never discovered globally; it uses `rea-session` to avoid the disabled file entry taking precedence. Claude Code has no globally registered REA server; its bundled config supplies the opt-in entry. For one-off operations, use `bun x rea-agents@6.10.1 --help` and the CLI without MCP.

When enabled, all five harnesses launch `bun x rea-agents@6.10.1 mcp`. Bun manages package retrieval; the package runs under Node. REA requires Node 22.23.4+, 24.22.1+, or 26.12.1+ in its supported release lines. Bun's runtime is not supported by this release. Keep the version aligned across the configurations, Pi session extension, and CLI guidance when upgrading.

The generic workflow is vendored separately at `skills/agent/reverse-engineer-anything` and tracked by the registry's `skills-lock.json`. It comes from upstream tag `rea-agents-6.10.1`, commit `8bb01b514ac766c0c3ecc8f362bd38186eaec9c2`, under the upstream MIT license. Update it through the registry's external-skill workflow alongside the package pin.

The configuration has no project paths or required native engines. Native providers need their own supported installations; Codex forwards `GHIDRA_INSTALL_DIR` and `JAVA_HOME` when present, and the other clients inherit their launch environment. REA 6.10.1 requires Ghidra 12.2 or newer within the supported 12.x line for its Ghidra provider. A connected MCP server alone does not establish native-provider readiness.

Removing this directory removes its MCP entries on the next build and bootstrap. Remove the separately vendored workflow and lock entry as well when retiring REA completely.
