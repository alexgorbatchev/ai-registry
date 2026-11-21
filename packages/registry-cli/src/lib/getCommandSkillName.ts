import { YAML } from "bun";

// Names the native skill a harness packages a registry command as: the command's
// frontmatter `name`, otherwise `command-<filename>` with leading hyphens removed and
// repeated hyphens collapsed. `harnessLabel` names the harness in error messages.
export function getCommandSkillName(commandFileName: string, content: string, harnessLabel: string): string {
  if (!commandFileName.endsWith(".md")) {
    throw new Error(`${harnessLabel} commands must use .md filenames: ${commandFileName}`);
  }

  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  const metadata: unknown = frontmatter === undefined ? undefined : YAML.parse(frontmatter);
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata) ||
    !("description" in metadata) ||
    typeof metadata.description !== "string" ||
    metadata.description.trim().length === 0
  ) {
    throw new Error(
      `${harnessLabel} command ${commandFileName} requires YAML frontmatter with a non-empty description.`,
    );
  }

  const name =
    "name" in metadata
      ? metadata.name
      : `command-${commandFileName.slice(0, -3).replace(/^-+/, "").replace(/-+/g, "-")}`;
  if (typeof name !== "string" || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(
      `Invalid ${harnessLabel} command skill name for ${commandFileName}: use 1-64 lowercase letters, digits, and single hyphens.`,
    );
  }

  return name;
}
