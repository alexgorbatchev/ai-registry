import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readlink, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { runSessionStart, syncProjectSkills } from "../syncProjectSkills";

const roots: string[] = [];
async function fixture(): Promise<string> {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(join(process.cwd(), ".tmp/project-skills-"));
  roots.push(root);
  return root;
}
async function skill(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await Bun.write(join(path, "SKILL.md"), "---\nname: example\ndescription: Example\n---\nInstructions\n");
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("discovers nested and linked bundles, deduplicates cycles, preserves native skills", async () => {
  const root = await fixture();
  await skill(join(root, ".agents/skills/team/deep/first"));
  await skill(join(root, "external/second"));
  await symlink(join(root, "external"), join(root, ".agents/skills/team/linked"));
  await symlink(join(root, ".agents/skills"), join(root, "external/cycle"));
  await symlink(join(root, "missing"), join(root, "external/broken"));
  await skill(join(root, ".claude/skills/native"));
  expect(await syncProjectSkills(root)).toBe(2);
  expect(await syncProjectSkills(root)).toBe(2);
  const entries = await readdir(join(root, ".claude/skills"));
  expect(entries).toHaveLength(3);
  expect(entries).toContain("native");
  const generated = entries.filter((entry) => entry !== "native");
  expect(await Promise.all(generated.map((entry) => Bun.file(join(root, ".claude/skills", entry, "SKILL.md")).exists())))
    .toEqual([true, true]);
  expect(await readlink(join(root, ".claude/skills", generated[0]!))).toContain(".agents/skills/");
  await rm(join(root, ".agents"), { recursive: true });
  expect(await syncProjectSkills(root)).toBe(0);
  expect(await readdir(join(root, ".claude/skills"))).toEqual(["native"]);
});

test("does not create configuration for projects without skills", async () => {
  const root = await fixture();
  expect(await syncProjectSkills(root)).toBe(0);
  expect(await readdir(root)).toEqual([]);
});

test("refuses to overwrite a replaced generated link", async () => {
  const root = await fixture();
  const sourcePath = join(root, ".agents/skills/team/example");
  await skill(sourcePath);
  await syncProjectSkills(root);
  const digest = new Bun.CryptoHasher("sha256").update(sourcePath).digest("hex");
  const destinationPath = join(root, ".claude/skills", `agents-${digest}-example`);
  await rm(destinationPath);
  await skill(destinationPath);
  await expect(syncProjectSkills(root)).rejects.toThrow("Project skill link conflicts with existing path:");
  expect(await Bun.file(join(destinationPath, "SKILL.md")).exists()).toBe(true);
});

test("startup entrypoint requests reload and rejects malformed input", async () => {
  const root = await fixture();
  await skill(join(root, ".agents/skills/nested/example"));
  expect(JSON.parse(await runSessionStart({ cwd: root })).hookSpecificOutput.reloadSkills).toBe(true);
  await expect(runSessionStart({})).rejects.toThrow("SessionStart input must contain cwd");
  const scriptPath = join(import.meta.dir, "../syncProjectSkills.ts");
  const result = Bun.spawnSync(["bun", scriptPath], {
    stdin: Buffer.from(JSON.stringify({ cwd: root })),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString()).hookSpecificOutput.reloadSkills).toBe(true);
  expect(await readdir(join(root, ".claude/skills"))).toHaveLength(1);
  const invalid = Bun.spawnSync(["bun", scriptPath], { stdin: Buffer.from("{}") });
  expect(invalid.exitCode).toBe(1);
  expect(invalid.stderr.toString()).toContain("SessionStart input must contain cwd");
});
