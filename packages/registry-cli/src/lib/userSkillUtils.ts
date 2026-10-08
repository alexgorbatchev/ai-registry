import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";

export function injectDisableModelInvocation(source: string): string {
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    return `---\ndisable-model-invocation: true\n---\n${source}`;
  }

  const isCrlf = source.startsWith("---\r\n");
  const newline = isCrlf ? "\r\n" : "\n";
  const fence = `---${newline}`;
  const end = source.indexOf(`${newline}---`, 3);

  if (end === -1) {
    return `${fence}disable-model-invocation: true${newline}${source.slice(fence.length)}`;
  }

  const frontmatter = source.slice(fence.length, end);
  const body = source.slice(end);

  if (frontmatter.includes("disable-model-invocation:")) {
    if (/disable-model-invocation:\s*true/.test(frontmatter)) {
      return source;
    }
    const updatedFrontmatter = frontmatter.replace(
      /disable-model-invocation:\s*false/,
      "disable-model-invocation: true",
    );
    return `${fence}${updatedFrontmatter}${body}`;
  }

  return `${fence}disable-model-invocation: true${newline}${frontmatter}${body}`;
}

export function removeDisableModelInvocation(source: string): string {
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    return source;
  }

  const isCrlf = source.startsWith("---\r\n");
  const newline = isCrlf ? "\r\n" : "\n";
  const fence = `---${newline}`;
  const end = source.indexOf(`${newline}---`, 3);

  if (end === -1) {
    return source;
  }

  const frontmatter = source.slice(fence.length, end);
  const body = source.slice(end);

  const updatedFrontmatter = frontmatter
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("disable-model-invocation:"))
    .join(newline);

  return `${fence}${updatedFrontmatter}${body}`;
}

export function parseSkillAuthor(content: string): string | null {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) return null;
  const match = frontmatter.match(/^author:\s*(.*)$/m);
  const author = match?.[1]?.trim();
  return author ? author : null;
}

export function getOutputSkillName(skillName: string, author?: string | null): string {
  if (!author || author === "alexgorbatchev" || author === "agorbatchev") {
    return skillName;
  }
  if (skillName.startsWith(`${author}-`)) {
    return skillName;
  }
  return `${author}-${skillName}`;
}

export function updateSkillName(source: string, newName: string): string {
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    return source;
  }

  const isCrlf = source.startsWith("---\r\n");
  const newline = isCrlf ? "\r\n" : "\n";
  const fence = `---${newline}`;
  const end = source.indexOf(`${newline}---`, 3);

  if (end === -1) {
    return source;
  }

  const frontmatter = source.slice(fence.length, end);
  const body = source.slice(end);

  const nameRegex = /^name:\s*(.*)$/m;
  if (nameRegex.test(frontmatter)) {
    const updatedFrontmatter = frontmatter.replace(nameRegex, `name: ${newName}`);
    return `${fence}${updatedFrontmatter}${body}`;
  }

  return `${fence}name: ${newName}${newline}${frontmatter}${body}`;
}

export function isUserSkillPath(targetPath: string): boolean {
  const normalizedPath = targetPath.replaceAll("\\", "/");
  return (
    normalizedPath.includes("/skills/user/") ||
    normalizedPath.startsWith("skills/user/") ||
    normalizedPath.endsWith("/skills/user") ||
    normalizedPath === "skills/user" ||
    /\/user\/[^/]+$/.test(normalizedPath)
  );
}

export type IHarnessSkillEntry = {
  name: string;
  sourcePath: string;
  isUser: boolean;
};

export async function readHarnessSkillEntries(harnessSkillsDir: string): Promise<IHarnessSkillEntry[]> {
  const assetMap = new Map<string, IHarnessSkillEntry>();
  if (!existsSync(harnessSkillsDir)) {
    return [];
  }

  const agentDir = join(harnessSkillsDir, "agent");
  const userDir = join(harnessSkillsDir, "user");

  if (existsSync(agentDir)) {
    const entries = await readdir(agentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      assetMap.set(entry.name, {
        name: entry.name,
        sourcePath: join(agentDir, entry.name),
        isUser: false,
      });
    }
  }

  if (existsSync(userDir)) {
    const entries = await readdir(userDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (assetMap.has(entry.name)) {
        throw new Error(
          `Duplicate skill name "${entry.name}" found in both agent and user harness skills directories in ${harnessSkillsDir}`,
        );
      }
      assetMap.set(entry.name, {
        name: entry.name,
        sourcePath: join(userDir, entry.name),
        isUser: true,
      });
    }
  }

  const rootEntries = await readdir(harnessSkillsDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.name === "agent" || entry.name === "user" || entry.name.startsWith(".")) continue;
    if (!entry.isDirectory()) continue;
    if (assetMap.has(entry.name)) continue;

    const sourcePath = join(harnessSkillsDir, entry.name);
    assetMap.set(entry.name, {
      name: entry.name,
      sourcePath,
      isUser: isUserSkillPath(sourcePath),
    });
  }

  return Array.from(assetMap.values()).sort((left, right) => left.name.localeCompare(right.name));
}
