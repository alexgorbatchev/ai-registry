import { lstat, mkdir, readdir, readlink, realpath, symlink, unlink } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

function linkName(sourcePath: string): string {
  const digest = new Bun.CryptoHasher("sha256").update(sourcePath).digest("hex");
  return `agents-${digest}-${basename(sourcePath)}`;
}

/** Expose recursive project bundles through Claude Code's flat native skill directory. */
export async function syncProjectSkills(projectPath: string): Promise<number> {
  const sourceRoot = resolve(projectPath, ".agents/skills");
  const destinationRoot = resolve(projectPath, ".claude/skills");
  const sources = new Map<string, string>();
  const visited = new Set<string>();
  async function visit(sourcePath: string): Promise<void> {
    let canonicalPath: string;
    try {
      canonicalPath = await realpath(sourcePath);
      if (!(await lstat(canonicalPath)).isDirectory()) return;
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
    if (visited.has(canonicalPath)) return;
    visited.add(canonicalPath);
    if (await Bun.file(join(sourcePath, "SKILL.md")).exists()) {
      sources.set(linkName(sourcePath), sourcePath);
      return;
    }
    for (const entry of (await readdir(sourcePath, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() || entry.isSymbolicLink()) await visit(join(sourcePath, entry.name));
    }
  }
  await visit(sourceRoot);
  let entries: string[];
  try {
    entries = await readdir(destinationRoot);
  } catch (error) {
    if (!isMissing(error)) throw error;
    entries = [];
  }
  for (const name of entries) {
    const destinationPath = join(destinationRoot, name);
    if (!(await lstat(destinationPath)).isSymbolicLink()) continue;
    const targetPath = await readlink(destinationPath);
    // Only remove links bearing this hook's exact generated name and project source target.
    if (targetPath.startsWith(sourceRoot + sep) && name === linkName(targetPath) && !sources.has(name)) {
      await unlink(destinationPath);
    }
  }
  if (sources.size > 0) await mkdir(destinationRoot, { recursive: true });
  for (const [name, sourcePath] of sources) {
    const destinationPath = join(destinationRoot, name);
    try {
      await symlink(sourcePath, destinationPath, "dir");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      if (!(await lstat(destinationPath)).isSymbolicLink() || await readlink(destinationPath) !== sourcePath) {
        throw new Error(`Project skill link conflicts with existing path: ${destinationPath}`);
      }
    }
  }
  return sources.size;
}

export async function runSessionStart(input: unknown, configuredProjectPath?: string): Promise<string> {
  if (typeof input !== "object" || input === null || !("cwd" in input) || typeof input.cwd !== "string") {
    throw new Error("SessionStart input must contain cwd");
  }
  const projectPath = configuredProjectPath || input.cwd;
  await syncProjectSkills(projectPath);
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", reloadSkills: true } });
}

if (import.meta.main) {
  try {
    console.log(await runSessionStart(await Bun.stdin.json(), process.env.CLAUDE_PROJECT_DIR));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
