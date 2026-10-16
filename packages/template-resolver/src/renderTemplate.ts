import ejs from "ejs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export type IRenderTemplateOptions = {
  content: string;
  sourcePath: string;
  repositoryRoot: string;
  variables: Record<string, string>;
  environment?: Record<string, string | undefined>;
};

export async function renderTemplate(options: IRenderTemplateOptions): Promise<string> {
  return ejs.render(options.content, {
    ...options.variables,
    file_path: options.sourcePath,
    file_dir: dirname(options.sourcePath),
    env(name: string, fallback?: string): string {
      const value = options.environment?.[name] ?? fallback;
      if (value === undefined) throw new Error(`Missing environment variable: ${name}`);
      return value;
    },
  }, {
    filename: options.sourcePath,
    root: options.repositoryRoot,
    views: [options.repositoryRoot],
    includer(originalPath, parsedPath) {
      const relativePath = relative(options.repositoryRoot, parsedPath ?? resolve(dirname(options.sourcePath), originalPath));
      if (relativePath === ".." || relativePath.startsWith("../") || isAbsolute(relativePath)) {
        throw new Error(`Include path escapes repository root: ${originalPath}`);
      }
      if (!parsedPath) throw new Error(`Missing include file: ${originalPath}`);
      return { filename: parsedPath };
    },
  });
}
