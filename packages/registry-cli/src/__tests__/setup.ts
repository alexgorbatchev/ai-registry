import { join } from "node:path";

import { factory_testRoot } from "./fixtures";

// Registry settings exported by the developer's shell would point tests at real overlays and
// workspaces. Tests start without them and set the ones they exercise explicitly.
for (const name of Object.keys(process.env)) {
  if (name.startsWith("AI_REGISTRY_")) delete process.env[name];
}
const testRoot = factory_testRoot("registry-tests");
process.env.REGISTRY_TEST_TMPDIR = testRoot;
process.env.TMPDIR = testRoot;
// Builds sync Claude Code MCP servers into `$CLAUDE_CONFIG_DIR/.claude.json`, so tests
// point it at scratch space instead of the developer's real Claude Code config.
process.env.CLAUDE_CONFIG_DIR = join(testRoot, "claude-config");
