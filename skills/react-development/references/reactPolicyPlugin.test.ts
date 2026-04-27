import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PLUGIN_FILE_PATH = path.resolve(import.meta.dir, 'reactPolicyPlugin.js');

describe('reactPolicyPlugin', () => {
  test('accepts valid root and child test ids', () => {
    const result = runOxlint(`
      export function Valid() {
        return (
          <section data-testid='Valid'>
            <div data-testid='Valid--body'>Ready</div>
          </section>
        );
      }
    `);

    expect(result.exitCode).toBe(0);
    expect(result.messages).toEqual([]);
  });

  test('reports imported createElement usage', () => {
    const result = runOxlint(`
      import { createElement } from 'react';

      export function Broken() {
        return createElement('div', { 'data-testid': 'Broken' });
      }
    `, {
      rules: {
        'repo-react/no-regular-create-element': 'error',
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.messages).toEqual([
      {
        code: 'repo-react(no-regular-create-element)',
        message: 'Use JSX instead of importing createElement from react in regular application code.',
      },
    ]);
  });

  test('reports React.createElement usage', () => {
    const result = runOxlint(`
      export function Broken() {
        return React.createElement('div', { 'data-testid': 'Broken' });
      }
    `, {
      rules: {
        'repo-react/no-regular-create-element': 'error',
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.messages).toEqual([
      {
        code: 'repo-react(no-regular-create-element)',
        message: 'Use JSX instead of React.createElement in regular application code.',
      },
    ]);
  });

  test('reports root and child test id violations', () => {
    const result = runOxlint(`
      export function Broken() {
        return (
          <div data-testid='Broken--root'>
            <button data-testid='Wrong--action'>Action</button>
          </div>
        );
      }
    `);

    expect(result.exitCode).toBe(1);
    expect(result.messages).toEqual([
      {
        code: 'repo-react(require-component-root-testid)',
        message: 'Exported component "Broken" must render a root data-testid or testId exactly equal to "Broken".',
      },
      {
        code: 'repo-react(require-component-root-testid)',
        message: 'Component "Broken" must use child test ids in the format "Broken--thing". Received "Wrong--action".',
      },
    ]);
  });
});

interface IOxlintResult {
  exitCode: number;
  messages: Array<{
    code: string;
    message: string;
  }>;
}

function runOxlint(
  fileContents: string,
  options: {
    rules?: Record<string, 'error'>;
    fileName?: string;
  } = {},
): IOxlintResult {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'react-policy-plugin-'));

  try {
    const fixtureFilePath = path.join(tempDir, options.fileName ?? 'fixture.tsx');
    const configFilePath = path.join(tempDir, '.oxlintrc.json');

    writeFileSync(fixtureFilePath, fileContents.trimStart());
    writeFileSync(
      configFilePath,
      JSON.stringify({
        jsPlugins: [PLUGIN_FILE_PATH],
        rules: options.rules ?? {
          'repo-react/require-component-root-testid': 'error',
        },
      }),
    );

    const spawnResult = Bun.spawnSync({
      cmd: [process.execPath, 'x', 'oxlint', '-c', configFilePath, '-f', 'json', fixtureFilePath],
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdout = new TextDecoder().decode(spawnResult.stdout);
    const stderr = new TextDecoder().decode(spawnResult.stderr);

    const filteredStderr = stderr
      .split('\n')
      .filter((line) => !line.includes('MODULE_TYPELESS_PACKAGE_JSON') && !line.includes('Reparsing as ES module') && !line.includes('To eliminate this warning') && !line.includes('node --trace-warnings') && line.trim() !== '')
      .join('\n');

    assert.equal(filteredStderr, '');

    const payload = JSON.parse(stdout) as {
      diagnostics?: Array<{
        code?: string;
        message?: string;
      }>;
    };

    return {
      exitCode: spawnResult.exitCode,
      messages: (payload.diagnostics ?? []).map((diagnostic) => ({
        code: diagnostic.code ?? '',
        message: diagnostic.message ?? '',
      })),
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
