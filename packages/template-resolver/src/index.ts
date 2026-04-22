import { readFile } from "fs/promises";
import { isAbsolute, relative, resolve } from "path";

const TEMPLATE_TAG_PATTERN = /(?<!\$){{\s*([^{}]+?)\s*}}/g;
const VARIABLE_NAME_PATTERN = /^[a-z0-9_]+$/;
const ENV_NAME_PATTERN = /^[A-Z0-9_]+$/;
const INCLUDE_PATTERN = /^include\s+"((?:[^"\\]|\\.)*)"$/;
const ENV_PATTERN = /^env\s+"((?:[^"\\]|\\.)*)"(?:\s+default\s+"((?:[^"\\]|\\.)*)")?$/;
const DEFAULT_MAX_INCLUDE_DEPTH = 32;

function isOwnedTemplateExpression(expression: string): boolean {
  return VARIABLE_NAME_PATTERN.test(expression) || expression.startsWith("include") || expression.startsWith("env");
}

export type IRenderTemplateOptions = {
  content: string;
  sourcePath: string;
  repositoryRoot: string;
  variables: Record<string, string>;
  environment?: Record<string, string | undefined>;
  maxIncludeDepth?: number;
};

function decodeQuotedValue(rawValue: string): string {
  const decoded = JSON.parse(`"${rawValue}"`);
  if (typeof decoded !== "string") {
    throw new Error(`Expected quoted string, got ${typeof decoded}`);
  }

  return decoded;
}

function formatIncludeStack(includeStack: string[]): string {
  return includeStack.join(" -> ");
}

function resolveRepositoryPath(repositoryRoot: string, includePath: string): string {
  if (isAbsolute(includePath)) {
    throw new Error(`Includes must use repository-root-relative paths, got absolute path: ${includePath}`);
  }

  const resolvedPath = resolve(repositoryRoot, includePath);
  const relativePath = relative(repositoryRoot, resolvedPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`Include path escapes repository root: ${includePath}`);
  }

  return resolvedPath;
}

async function renderTag(
  expression: string,
  options: IRenderTemplateOptions,
  includeStack: string[],
): Promise<string> {
  if (VARIABLE_NAME_PATTERN.test(expression)) {
    const variableValue = options.variables[expression];
    if (variableValue === undefined) {
      throw new Error(`Unknown template variable in ${options.sourcePath}: ${expression}`);
    }

    return variableValue;
  }

  const includeMatch = expression.match(INCLUDE_PATTERN);
  if (includeMatch) {
    const includePath = decodeQuotedValue(includeMatch[1]);
    const resolvedIncludePath = resolveRepositoryPath(options.repositoryRoot, includePath);

    if (includeStack.includes(resolvedIncludePath)) {
      throw new Error(
        `Circular template include detected: ${formatIncludeStack([...includeStack, resolvedIncludePath])}`,
      );
    }

    if (includeStack.length >= (options.maxIncludeDepth ?? DEFAULT_MAX_INCLUDE_DEPTH)) {
      throw new Error(
        `Template include depth exceeded while resolving ${resolvedIncludePath}: ${formatIncludeStack([...includeStack, resolvedIncludePath])}`,
      );
    }

    let includedContent = "";
    try {
      includedContent = await readFile(resolvedIncludePath, "utf-8");
    } catch (error) {
      const includeChain = formatIncludeStack([...includeStack, resolvedIncludePath]);
      if (error instanceof Error) {
        throw new Error(`Failed to include ${resolvedIncludePath}: ${error.message}\nInclude stack: ${includeChain}`);
      }

      throw new Error(`Failed to include ${resolvedIncludePath}\nInclude stack: ${includeChain}`);
    }

    return renderTemplateInternal(
      {
        ...options,
        content: includedContent,
        sourcePath: resolvedIncludePath,
      },
      [...includeStack, resolvedIncludePath],
    );
  }

  const envMatch = expression.match(ENV_PATTERN);
  if (envMatch) {
    const envName = decodeQuotedValue(envMatch[1]);
    if (!ENV_NAME_PATTERN.test(envName)) {
      throw new Error(`Invalid environment variable name in ${options.sourcePath}: ${envName}`);
    }

    const envValue = options.environment?.[envName];
    if (envValue !== undefined) {
      return envValue;
    }

    if (envMatch[2] !== undefined) {
      return decodeQuotedValue(envMatch[2]);
    }

    throw new Error(`Missing environment variable in ${options.sourcePath}: ${envName}`);
  }

  throw new Error(`Unsupported template tag in ${options.sourcePath}: ${expression}`);
}

async function renderTemplateInternal(
  options: IRenderTemplateOptions,
  includeStack: string[],
): Promise<string> {
  let renderedContent = "";
  let lastIndex = 0;

  for (const match of options.content.matchAll(TEMPLATE_TAG_PATTERN)) {
    const fullMatch = match[0];
    const expression = match[1]?.trim() ?? "";
    const matchIndex = match.index ?? 0;

    renderedContent += options.content.slice(lastIndex, matchIndex);

    if (!isOwnedTemplateExpression(expression)) {
      renderedContent += fullMatch;
      lastIndex = matchIndex + fullMatch.length;
      continue;
    }

    renderedContent += await renderTag(expression, options, includeStack);
    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex === 0) {
    return options.content;
  }

  renderedContent += options.content.slice(lastIndex);
  return renderedContent;
}

export async function renderTemplate(options: IRenderTemplateOptions): Promise<string> {
  return renderTemplateInternal(options, [options.sourcePath]);
}
