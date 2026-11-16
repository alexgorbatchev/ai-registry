import type { ICommandLineSpec } from "./readCommandLine";

// Command lines of the `src/bin/` entry points that change files, Git state, or harness homes,
// keyed by entry point file name. Each entry point reads its arguments with `readCommandLine`
// before doing any work, so `--help` and invalid arguments never start a command.
export const ENTRY_POINT_COMMAND_LINES = {
  // The command validates the wrapped `npx skills add` arguments itself.
  "add-vendored-skill.ts": {
    usage: "just skills-add 'npx skills add <source> --skill <name> [--skill <name>...]'",
    description:
      "Vendor external skills with the repository's required Skills CLI flags, then rebuild generated outputs.",
    isPassThrough: true,
  },
  "bootstrap.ts": {
    usage: "just bootstrap [options]",
    description:
      "Install dependencies, build generated outputs, and apply them to this machine's harness homes and ~/.local/bin. Runs only from the primary checkout.",
    flags: { yes: { short: "y", description: "Pass -y to the build" } },
  },
  "build.ts": {
    usage: "just build [options]",
    description: "Build generated harness outputs into .output/ from registry sources and overlays.",
    flags: { yes: { short: "y", description: "Confirm without prompting" } },
  },
  "install-git-hooks.ts": {
    usage: "just registry-cli install-git-hooks",
    description: "Point Git at the checked-in hooks in .githooks/.",
  },
  "scheduled-update-logger.ts": {
    usage: "just scheduled-update",
    description: "Internal scheduled-update logger; run `just scheduled-update`, which starts it under the lock.",
  },
  "scheduled-update-worker.ts": {
    usage: "just scheduled-update",
    description:
      "Internal scheduled-update worker; run `just scheduled-update`, which holds the lock and logs its output.",
  },
  "scheduled-update.ts": {
    usage: "just scheduled-update",
    description:
      "Pull, bootstrap, and push this checkout under the scheduled-update lock, logging to .state/scheduled-update.log.",
  },
  "smoke-bootstrap.ts": {
    usage: "just bootstrap-smoke",
    description: "Validate the bootstrap flow against a fake home in .tmp/bootstrap-smoke/.",
  },
  "sync-opencode-docs.ts": {
    usage: "just sync-opencode-docs",
    description: "Refresh the checked-in OpenCode docs snapshot from upstream.",
  },
  "update-vendored-skills.ts": {
    usage: "bun packages/registry-cli/src/bin/update-vendored-skills.ts [skill...]",
    description:
      "Refresh vendored external skills from skills-lock.json; `just skills-update` refreshes all and rebuilds.",
    positionals: "skill...  Vendored skill names to refresh (default: all)",
  },
} satisfies Record<string, ICommandLineSpec>;
