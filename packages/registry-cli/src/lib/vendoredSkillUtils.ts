import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { removeDisableModelInvocation } from "./userSkillUtils";

export function extractAuthorFromSource(source: string): string | null {
  if (!source) return null;
  const trimmed = source.trim();
  if (!trimmed) return null;

  // Git SSH URL: git@github.com:owner/repo.git
  const sshMatch = trimmed.match(/^git@[^:]+:([^/]+)\/[^/]+/);
  if (sshMatch) {
    return sshMatch[1];
  }

  // HTTP(S) URL: https://github.com/owner/repo...
  const urlMatch = trimmed.match(/^https?:\/\/[^/]+\/([^/]+)\/[^/]+/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Remove trailing branch/ref/skill specifier: #ref or @skill
  const cleaned = trimmed.split("#")[0].split("@")[0].replace(/\.git$/, "");

  // Prefixes like github:owner/repo
  const prefixMatch = cleaned.match(/^[a-z0-9_-]+:([^/]+)\/[^/]+/i);
  if (prefixMatch) {
    return prefixMatch[1];
  }

  // Shorthand owner/repo
  const shorthandMatch = cleaned.match(/^([^/]+)\/[^/]+/);
  if (shorthandMatch) {
    return shorthandMatch[1];
  }

  return null;
}

export function ensureSkillAuthor(source: string, author: string): string {
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    return `---\nauthor: ${author}\n---\n${source}`;
  }

  const isCrlf = source.startsWith("---\r\n");
  const newline = isCrlf ? "\r\n" : "\n";
  const fence = `---${newline}`;
  const end = source.indexOf(`${newline}---`, 3);

  if (end === -1) {
    return `${fence}author: ${author}${newline}${source.slice(fence.length)}`;
  }

  const frontmatter = source.slice(fence.length, end);
  const body = source.slice(end);

  const authorRegex = /^author:(.*)$/m;
  if (authorRegex.test(frontmatter)) {
    const match = frontmatter.match(authorRegex);
    const existingAuthor = match?.[1]?.trim() ?? "";
    if (existingAuthor === "" || existingAuthor === "alexgorbatchev") {
      const updatedFrontmatter = frontmatter.replace(authorRegex, `author: ${author}`);
      return `${fence}${updatedFrontmatter}${body}`;
    }
    return source;
  }

  const trimmedFm = frontmatter.trimEnd();
  const updatedFrontmatter = `${trimmedFm}${newline}author: ${author}`;
  return `${fence}${updatedFrontmatter}${body}`;
}

export async function resolveVendoredSkillAuthor(
  root: string,
  skillName: string,
  source?: string,
): Promise<string | null> {
  if (source) {
    const authorFromSource = extractAuthorFromSource(source);
    if (authorFromSource) {
      return authorFromSource;
    }
  }

  const lockPath = join(root, "skills-lock.json");
  const lockFile = Bun.file(lockPath);
  if (await lockFile.exists()) {
    try {
      const parsed = (await lockFile.json()) as { skills?: Record<string, { source?: string }> };
      const entrySource = parsed.skills?.[skillName]?.source;
      if (entrySource) {
        return extractAuthorFromSource(entrySource);
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  return null;
}

export async function relocateVendoredSkill(
  root: string,
  skillName: string,
  source?: string,
): Promise<void> {
  const flatPath = join(root, "skills", skillName);
  if (!existsSync(flatPath)) {
    return;
  }

  const userDir = join(root, "skills", "user", skillName);
  const isExistingUser = existsSync(userDir);

  const skillFile = join(flatPath, "SKILL.md");
  let isUserSkill = isExistingUser;

  const skillFileRef = Bun.file(skillFile);
  if (await skillFileRef.exists()) {
    let content = await skillFileRef.text();
    if (content.includes("disable-model-invocation: true")) {
      isUserSkill = true;
    }
    if (isUserSkill) {
      content = removeDisableModelInvocation(content);
    }
    const author = await resolveVendoredSkillAuthor(root, skillName, source);
    if (author) {
      content = ensureSkillAuthor(content, author);
    }
    await Bun.write(skillFile, content);
  }

  const targetGroup = isUserSkill ? "user" : "agent";
  const targetDir = join(root, "skills", targetGroup, skillName);
  await mkdir(dirname(targetDir), { recursive: true });
  await rm(targetDir, { recursive: true, force: true });
  await rename(flatPath, targetDir);
}
