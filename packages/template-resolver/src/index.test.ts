import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { renderTemplate } from "./index";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "template-resolver-tests");
const createdDirectories: string[] = [];

async function createTestDirectory(): Promise<string> {
  const testDirectory = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(testDirectory);
  return testDirectory;
}

async function writeRepositoryFile(
  repositoryRoot: string,
  relativePath: string,
  content: string,
): Promise<string> {
  const filePath = join(repositoryRoot, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

beforeAll(async (): Promise<void> => {
  await mkdir(TEST_ROOT, { recursive: true });
});

afterAll(async (): Promise<void> => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

test("renders variables, recursive includes, and environment values", async (): Promise<void> => {
  const repositoryRoot = await createTestDirectory();
  const sourcePath = await writeRepositoryFile(
    repositoryRoot,
    "profiles/developer/prompt.md",
    [
      "Agent root: {{ repo_root }}",
      '{{ include "shared/intro.md" }}',
    ].join("\n"),
  );

  await writeRepositoryFile(
    repositoryRoot,
    "shared/intro.md",
    [
      "Intro start",
      '{{ include "shared/footer.md" }}',
    ].join("\n"),
  );
  await writeRepositoryFile(
    repositoryRoot,
    "shared/footer.md",
    "Footer {{ env \"TEST_TEMPLATE_VALUE\" }}",
  );

  const rendered = await renderTemplate({
    content: await Bun.file(sourcePath).text(),
    sourcePath,
    repositoryRoot,
    variables: {
      repo_root: repositoryRoot,
    },
    environment: {
      TEST_TEMPLATE_VALUE: "works",
    },
  });

  expect(rendered).toBe([
    `Agent root: ${repositoryRoot}`,
    "Intro start",
    "Footer works",
  ].join("\n"));
});

test("uses the default for missing environment variables", async (): Promise<void> => {
  const repositoryRoot = await createTestDirectory();
  const sourcePath = await writeRepositoryFile(
    repositoryRoot,
    "prompt.md",
    'Value: {{ env "MISSING_TEMPLATE_VALUE" default "fallback" }}',
  );

  const rendered = await renderTemplate({
    content: await Bun.file(sourcePath).text(),
    sourcePath,
    repositoryRoot,
    variables: {},
    environment: {},
  });

  expect(rendered).toBe("Value: fallback");
});

test("rejects includes that escape the repository root", async (): Promise<void> => {
  const repositoryRoot = await createTestDirectory();
  const sourcePath = await writeRepositoryFile(
    repositoryRoot,
    "prompt.md",
    '{{ include "../outside.md" }}',
  );

  await expect(renderTemplate({
    content: await Bun.file(sourcePath).text(),
    sourcePath,
    repositoryRoot,
    variables: {},
    environment: {},
  })).rejects.toThrow("Include path escapes repository root");
});

test("reports circular include chains", async (): Promise<void> => {
  const repositoryRoot = await createTestDirectory();
  const sourcePath = await writeRepositoryFile(
    repositoryRoot,
    "a.md",
    '{{ include "b.md" }}',
  );

  await writeRepositoryFile(repositoryRoot, "b.md", '{{ include "a.md" }}');

  await expect(renderTemplate({
    content: await Bun.file(sourcePath).text(),
    sourcePath,
    repositoryRoot,
    variables: {},
    environment: {},
  })).rejects.toThrow("Circular template include detected");
});

test("reports the include stack for missing include files", async (): Promise<void> => {
  const repositoryRoot = await createTestDirectory();
  const sourcePath = await writeRepositoryFile(
    repositoryRoot,
    "prompt.md",
    '{{ include "missing.md" }}',
  );

  await expect(renderTemplate({
    content: await Bun.file(sourcePath).text(),
    sourcePath,
    repositoryRoot,
    variables: {},
    environment: {},
  })).rejects.toThrow("Include stack");
});

test("ignores GitHub Actions style expressions", async (): Promise<void> => {
  const repositoryRoot = await createTestDirectory();
  const sourcePath = await writeRepositoryFile(
    repositoryRoot,
    "workflow.yml",
    "token: ${{ secrets.GITHUB_TOKEN }}",
  );

  const rendered = await renderTemplate({
    content: await Bun.file(sourcePath).text(),
    sourcePath,
    repositoryRoot,
    variables: {},
    environment: {},
  });

  expect(rendered).toBe("token: ${{ secrets.GITHUB_TOKEN }}");
});

test("ignores Go template expressions", async (): Promise<void> => {
  const repositoryRoot = await createTestDirectory();
  const sourcePath = await writeRepositoryFile(
    repositoryRoot,
    "release.yml",
    "ldflags: -X main.version={{.Version}}",
  );

  const rendered = await renderTemplate({
    content: await Bun.file(sourcePath).text(),
    sourcePath,
    repositoryRoot,
    variables: {},
    environment: {},
  });

  expect(rendered).toBe("ldflags: -X main.version={{.Version}}");
});
