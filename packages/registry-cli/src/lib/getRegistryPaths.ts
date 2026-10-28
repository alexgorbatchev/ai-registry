import { existsSync } from "fs";
import { homedir } from "os";
import { delimiter, join, resolve } from "path";

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
  overlays: string[];
  harnesses: string;
  skills: string;
  commands: string;
  profiles: string;
  output: string;
  temp: string;
};

export function getRegistryPaths(): IRegistryPaths {
  const root = resolveRepoRoot();
  const rawOverlays = (process.env.AI_REGISTRY_OVERLAY ?? "").split(delimiter);
  const resolvedOverlays = rawOverlays.filter((entry) => entry.trim()).map((entry) => resolvePathWithHome(entry, root));
  const overlays: string[] = [];
  // Keep the last occurrence so repeated entries preserve last-wins precedence.
  const uniqueOverlays = Array.from(new Set(resolvedOverlays.reverse())).reverse();
  for (const resolvedOverlay of uniqueOverlays) {
    if (!existsSync(resolvedOverlay)) {
      console.warn(
        `⚠️ Overlay directory does not exist: ${resolvedOverlay} (from AI_REGISTRY_OVERLAY)`,
      );
    } else {
      overlays.push(resolvedOverlay);
    }
  }

  return {
    root,
    overlays,
    harnesses: join(root, "harnesses"),
    skills: join(root, "skills"),
    commands: join(root, "commands"),
    profiles: join(root, "profiles"),
    output: join(root, ".output"),
    temp: join(root, ".tmp"),
  };
}
