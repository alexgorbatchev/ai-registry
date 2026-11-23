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

export interface IToolManifest {
  // Files the tool's own installer manages, such as the scripts its hooks run; `~`
  // expands to the home directory and relative paths resolve from the tool's directory.
  requires: string[];
  // Text that identifies the tool's settings values, such as its install directory, so
  // the tool's own edits to harness settings sync into its overlay.
  owns: string[];
}

function readStringList(manifest: unknown, key: string, manifestPath: string): string[] {
  const value = typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, key) : undefined;
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim() !== "")) {
    throw new Error(`${manifestPath}: "${key}" must be a list of non-empty strings`);
  }
  return value;
}

// Reads a tool overlay's optional `tool.json`.
export function readToolManifest(toolDir: string): IToolManifest {
  const manifestPath = join(toolDir, TOOL_MANIFEST_NAME);
  if (!existsSync(manifestPath)) return { requires: [], owns: [] };
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf-8"));
  return {
    requires: readStringList(manifest, "requires", manifestPath).map((path) => resolvePathWithHome(path, toolDir)),
    owns: readStringList(manifest, "owns", manifestPath),
  };
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
    const missingPath = readToolManifest(toolDir).requires.find((path) => !existsSync(path));
    if (missingPath !== undefined) {
      console.log(`⏭️ Skipping tool overlay ${toolDir}: ${missingPath} does not exist on this machine`);
    }
    return missingPath === undefined;
  });
}

export function getRegistryOverlays(root: string): string[] {
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
  return overlays;
}

export function getRegistryPaths(): IRegistryPaths {
  const root = resolveRepoRoot();
  const overlays = getRegistryOverlays(root);

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
