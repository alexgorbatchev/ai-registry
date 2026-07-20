import { join, resolve } from "path";

function resolveRepoRoot(): string {
  // Use process.cwd() so that smoke tests that clone the repo and run from the clone work correctly.
  return resolve(process.cwd());
}

export function getRegistryPaths() {
  const root = resolveRepoRoot();
  return {
    root,
    harnesses: join(root, "harnesses"),
    skills: join(root, "skills"),
    commands: join(root, "commands"),
    profiles: join(root, "profiles"),
    output: join(root, ".output"),
    temp: join(root, ".tmp"),
  };
}
