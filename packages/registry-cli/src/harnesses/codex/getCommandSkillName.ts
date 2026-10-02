import { YAML } from "bun";

export function getCommandSkillName(commandFileName: string, content: string): string {
  if (!commandFileName.endsWith(".md")) {
    throw new Error(`Codex commands must use .md filenames: ${commandFileName}`);
  }

  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  const metadata: unknown = frontmatter === undefined ? undefined : YAML.parse(frontmatter);
  if (
    typeof metadata !== "object" || metadata === null || Array.isArray(metadata) ||
    !("description" in metadata) || typeof metadata.description !== "string" ||
    metadata.description.trim().length === 0
  ) {
    throw new Error(`Codex command ${commandFileName} requires YAML frontmatter with a non-empty description.`);
  }

  const name = "name" in metadata
    ? metadata.name
    : `command-${commandFileName.slice(0, -3).replace(/^-+/, "").replace(/-+/g, "-")}`;
  if (typeof name !== "string" || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(
      `Invalid Codex command skill name for ${commandFileName}: use 1-64 lowercase letters, digits, and single hyphens.`,
    );
  }

  return name;
}
