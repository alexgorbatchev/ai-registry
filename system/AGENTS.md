Shared system instructions. `system.md` is the system prompt every generated harness ships. Before changing its distribution, read [harness mappings](../docs/internal/references/registry-harness-mapping.md).

OpenCode reads `system.md` unrendered through the `instructions` entry in `harnesses/opencode/opencode.jsonc`, so keep it free of template tags. For a private value such as a hostname, name an environment variable the agent reads at run time and export it from private shell configuration.
