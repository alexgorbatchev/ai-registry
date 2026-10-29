import { isAbsolute } from 'node:path';
import type { NativeAction, NativeManifest, NativeScope } from './nativeTypes';
import type { PreservedArtifact } from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function isAction(value: unknown): value is NativeAction {
  return (
    isObject(value) &&
    typeof value.path === 'string' &&
    isAbsolute(value.path) &&
    typeof value.identity === 'string' &&
    /^[a-f0-9]{64}$/.test(value.identity) &&
    typeof value.bytes === 'number' &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes >= 0 &&
    value.kind === 'cache' &&
    value.repository === null
  );
}
function isPreserved(value: unknown): value is PreservedArtifact {
  return (
    isObject(value) && typeof value.path === 'string' && isAbsolute(value.path) && typeof value.reason === 'string'
  );
}
function isScope(value: unknown): value is NativeScope {
  return (
    isObject(value) &&
    typeof value.path === 'string' &&
    isAbsolute(value.path) &&
    Array.isArray(value.entries) &&
    value.entries.every((entry) => typeof entry === 'string' && entry !== '.' && entry !== '..' && !entry.includes('/'))
  );
}
export async function readNativeManifest(path: string): Promise<NativeManifest> {
  const value: unknown = await Bun.file(path).json();
  if (
    !isObject(value) ||
    value.version !== 1 ||
    typeof value.root !== 'string' ||
    !Array.isArray(value.actions) ||
    !value.actions.every(isAction) ||
    !Array.isArray(value.preserved) ||
    !value.preserved.every(isPreserved) ||
    !Array.isArray(value.scopes) ||
    !value.scopes.every(isScope) ||
    !Array.isArray(value.processWarnings) ||
    !value.processWarnings.every((entry) => typeof entry === 'string')
  ) {
    throw new Error('Invalid native cleanup manifest; create a fresh review');
  }
  return {
    version: 1,
    root: value.root,
    actions: value.actions,
    preserved: value.preserved,
    scopes: value.scopes,
    processWarnings: value.processWarnings,
  };
}
