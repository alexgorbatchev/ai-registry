import { existsSync, readFileSync, readdirSync } from "fs";
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
  /** Tool overlays under `tools/`, sorted by name; layered before `overlays`. */
  tools: string[];
  /** Private overlays from `AI_REGISTRY_OVERLAY`, in precedence order. */
  overlays: string[];
  harnesses: string;
  skills: string;
  commands: string;
  systemPrompt: string;
  output: string;
  /** Disposable development artifacts. */
  temp: string;
  /** Long-lived unchecked state, such as the settings-sync merge base. */
  state: string;
};

const TOOL_MANIFEST_NAME = "tool.json";

// The paths a tool overlay's optional `tool.json` lists under `requires`, such as the
// scripts its hooks run; `~` expands to the home directory and relative paths resolve
// from the tool's directory.
function readRequiredPaths(toolDir: string): string[] {
  const manifestPath = join(toolDir, TOOL_MANIFEST_NAME);
  if (!existsSync(manifestPath)) return [];
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const requires = typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, "requires") : undefined;
  if (requires === undefined) return [];
  if (!Array.isArray(requires) || !requires.every((path) => typeof path === "string" && path.trim() !== "")) {
    throw new Error(`${manifestPath}: "requires" must be a list of non-empty paths`);
  }
  return requires.map((path: string) => resolvePathWithHome(path, toolDir));
}

// Each directory under `tools/` is one tool overlay. Sorting by code point keeps the
// layering order the same on every machine. A tool whose required paths are missing
// is not installed on this machine and is left out, so its settings never point at
// files that do not exist.
export function listToolOverlays(toolsDir: string): string[] {
  if (!existsSync(toolsDir)) return [];
  const toolDirs = readdirSync(toolsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort()
    .map((name) => join(toolsDir, name));
  return toolDirs.filter((toolDir) => {
    const missingPath = readRequiredPaths(toolDir).find((path) => !existsSync(path));
    if (missingPath !== undefined) {
      console.log(`⏭️ Skipping tool overlay ${toolDir}: ${missingPath} does not exist on this machine`);
    }
    return missingPath === undefined;
  });
}

export function getRegistryPaths(): IRegistryPaths {
  const root = resolveRepoRoot();
  const rawOverlays = (process.env.AI_REGISTRY_OVERLAY ?? "").split(delimiter);
  const resolvedOverlays = rawOverlays.filter((entry) => entry.trim()).map((entry) => resolvePathWithHome(entry, root));
  const overlays: string[] = [];
  // Keep the last occurrence so repeated entries preserve last-wins precedence.
  const uniqueOverlays = Array.from(new Set(resolvedOverlays.reverse())).reverse();
  for (const resolvedOverlay of uniqueOverlays) {
    if (!existsSync(resolvedOverlay)) {
      console.warn(`⚠️ Overlay directory does not exist: ${resolvedOverlay} (from AI_REGISTRY_OVERLAY)`);
    } else {
      overlays.push(resolvedOverlay);
    }
  }

  return {
    root,
    tools: listToolOverlays(join(root, "tools")),
    overlays,
    harnesses: join(root, "harnesses"),
    skills: join(root, "skills"),
    commands: join(root, "commands"),
    systemPrompt: join(root, "system", "system.md"),
    output: join(root, ".output"),
    temp: join(root, ".tmp"),
    state: join(root, ".state"),
  };
}
