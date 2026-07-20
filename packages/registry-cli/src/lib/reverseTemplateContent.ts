import { realpathSync, existsSync } from "fs";
import type { ITemplateContext } from "./harnessBuild";

export function reverseTemplateContent(content: string, templateContext: ITemplateContext): string {
  let result = content;

  const replacements: Array<{ path: string; token: string }> = [];

  const rawReplacements = [
    { path: templateContext.skills_dir, token: "{{skills_dir}}" },
    { path: templateContext.commands_dir, token: "{{commands_dir}}" },
    { path: templateContext.profiles_dir, token: "{{profiles_dir}}" },
    { path: templateContext.output_dir, token: "{{output_dir}}" },
    { path: templateContext.repo_root, token: "{{repo_root}}" },
  ];

  for (const item of rawReplacements) {
    if (!item.path) continue;
    replacements.push(item);

    // Resolve realpath to handle symlinked directories
    try {
      if (existsSync(item.path)) {
        const resolvedPath = realpathSync(item.path);
        if (resolvedPath !== item.path) {
          replacements.push({ path: resolvedPath, token: item.token });
        }
      }
    } catch {
      // Ignore resolution errors for virtual/non-existent paths in tests
    }
  }

  // Sort replacements by path length descending to ensure specific paths are replaced before parent paths
  replacements.sort((a, b) => b.path.length - a.path.length);

  for (const { path, token } of replacements) {
    const forwardSlashPath = path.replaceAll("\\", "/");
    const backwardSlashPath = path.replaceAll("/", "\\");

    result = result.replaceAll(forwardSlashPath, token);
    result = result.replaceAll(backwardSlashPath, token);
  }

  return result;
}
