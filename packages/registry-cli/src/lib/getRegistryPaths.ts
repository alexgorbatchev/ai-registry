import { existsSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";

function resolveRepoRoot(): string {
  // Use process.cwd() so that smoke tests that clone the repo and run from the clone work correctly.
  return resolve(process.cwd());
}

export function resolvePathWithHome(inputPath: string, rootDir: string): string {
  const trimmed = inputPath.trim();
  if (trimmed === "~") {
    return homedir();
  }
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return join(homedir(), trimmed.slice(2));
  }
  return resolve(rootDir, trimmed);
}

export type IRegistryPaths = {
  root: string;
  overlay: string | null;
  harnesses: string;
  skills: string;
  commands: string;
  profiles: string;
  output: string;
  temp: string;
};

export function getRegistryPaths(): IRegistryPaths {
  const root = resolveRepoRoot();
  const rawOverlay = process.env.AI_REGISTRY_OVERLAY?.trim();
  let overlay: string | null = null;

  if (rawOverlay && rawOverlay.length > 0) {
    const resolvedOverlay = resolvePathWithHome(rawOverlay, root);
    if (!existsSync(resolvedOverlay)) {
      throw new Error(
        `Overlay directory does not exist: ${resolvedOverlay} (from AI_REGISTRY_OVERLAY=${rawOverlay})`,
      );
    }
    overlay = resolvedOverlay;
  }

  return {
    root,
    overlay,
    harnesses: join(root, "harnesses"),
    skills: join(root, "skills"),
    commands: join(root, "commands"),
    profiles: join(root, "profiles"),
    output: join(root, ".output"),
    temp: join(root, ".tmp"),
  };
}
