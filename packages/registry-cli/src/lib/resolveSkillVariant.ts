import { YAML } from "bun";
import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { getErrorMessage } from "./getErrorMessage";

type ISkillIdentity = {
  name: string;
  author: string;
};

export function parseSkillIdentity(content: string, sourcePath: string): ISkillIdentity {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match || !match[2].trim()) {
    throw new Error(`Invalid hostname skill variant: ${sourcePath} requires YAML frontmatter and a non-empty body.`);
  }
  const frontmatter: unknown = YAML.parse(match[1]);
  if (typeof frontmatter !== "object" || frontmatter === null || Array.isArray(frontmatter)) {
    throw new Error(`Invalid hostname skill variant: ${sourcePath} requires a YAML mapping.`);
  }
  const name: unknown = Reflect.get(frontmatter, "name");
  const description: unknown = Reflect.get(frontmatter, "description");
  const author: unknown = Reflect.get(frontmatter, "author");
  if (
    typeof name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ||
    typeof description !== "string" || !description.trim() ||
    typeof author !== "string" || !author.trim()
  ) {
    throw new Error(`Invalid hostname skill variant: ${sourcePath} requires a kebab-case name and non-empty description and author.`);
  }
  return { name, author };
}

export async function resolveSkillVariant(sourceDir: string, hostname?: string): Promise<string | null> {
  const defaultPath = join(sourceDir, "SKILL.md");
  if (!await Bun.file(defaultPath).exists()) return null;
  if (hostname === undefined) return defaultPath;

  const variantsDir = join(sourceDir, "variants");
  const variants = await readdir(variantsDir, { withFileTypes: true }).catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return [];
    throw error;
  });
  const variant = variants.find((entry) => entry.name === hostname);
  if (variant === undefined) return defaultPath;
  const variantDir = join(variantsDir, variant.name);
  if (!variant.isDirectory()) {
    throw new Error(`Invalid hostname skill variant directory: ${variantDir}`);
  }

  const variantPath = join(variantDir, "SKILL.md");
  try {
    const variantFileStats = await lstat(variantPath);
    if (!variantFileStats.isFile()) throw new Error("SKILL.md must be a regular file.");
    const variantIdentity = parseSkillIdentity(await Bun.file(variantPath).text(), variantPath);
    const defaultIdentity = parseSkillIdentity(await Bun.file(defaultPath).text(), defaultPath);
    if (variantIdentity.name !== defaultIdentity.name || variantIdentity.author !== defaultIdentity.author) {
      throw new Error("Variant name and author must match the default SKILL.md.");
    }
  } catch (error) {
    throw new Error(`Invalid hostname skill variant: ${variantPath}: ${getErrorMessage(error)}`, { cause: error });
  }
  return variantPath;
}
