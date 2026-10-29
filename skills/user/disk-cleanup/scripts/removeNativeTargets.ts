import { readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ensureAbsent, isWithin, validatePath } from './filesystemUtils';
import { assertDisjoint } from './inventory';
import { inspectNativeProcesses } from './inspectNativeProcesses';
import { readNativeManifest } from './readNativeManifest';
import { createNativeLog, nativeIdentity, validateNativeTarget } from './reviewNativeTargets';
import { runInspectionCommand } from './runInspectionCommand';
import type { NativeAction, NativeRemoval } from './nativeTypes';
import type { InspectionRunner } from './types';

export async function removeNativeTargets(
  root: string,
  manifestPath: string,
  execute: boolean,
  runner: InspectionRunner = runInspectionCommand,
): Promise<NativeRemoval> {
  manifestPath = await validatePath(root, manifestPath);
  const manifest = await readNativeManifest(manifestPath);
  if (manifest.root !== root) throw new Error('Manifest root does not match --root');
  assertDisjoint(root, [
    ...manifest.actions.map((action) => action.path),
    ...manifest.preserved.map((entry) => entry.path),
  ]);
  if (manifest.actions.some((action) => action.path === join(root, '.tmp') || isWithin(action.path, manifestPath))) {
    throw new Error('Cleanup would remove its manifest or execution logs');
  }
  const parents = new Set([...manifest.actions, ...manifest.preserved].map((entry) => dirname(entry.path)));
  if (manifest.scopes.length !== parents.size || manifest.scopes.some((scope) => !parents.delete(scope.path))) {
    throw new Error('Manifest scopes do not match the reviewed target parents');
  }
  for (const scope of manifest.scopes) if (scope.path !== root) await validatePath(root, scope.path);
  async function validate(action: NativeAction): Promise<void> {
    await validateNativeTarget(root, action.path);
    if ((await nativeIdentity(action.path)) !== action.identity)
      throw new Error(`Target changed since review: ${action.path}`);
  }
  // A replacement or newly embedded repository invalidates the entire batch before the first removal.
  for (const action of manifest.actions) await validate(action);
  const result: NativeRemoval = {
    execute,
    actions: manifest.actions,
    removed: [],
    preserved: [...manifest.preserved],
    newEntries: [],
    failure: null,
    before: null,
    after: null,
    logPath: null,
    freeBeforeBytes: null,
    freeAfterBytes: null,
    reclaimedBytes: null,
    commands: [],
  };
  if (!execute) return result;
  const recordedRunner: InspectionRunner = async (args) => {
    const report = await runner(args);
    result.commands.push({ args, exitCode: report.exitCode, stderr: report.stderr });
    return report;
  };
  result.logPath = join(await createNativeLog(root), 'execution.json');
  async function capacity(): Promise<string> {
    const report = await recordedRunner(['df', '-B1', '--output=avail', '--', root]);
    if (report.exitCode !== 0) throw new Error(`df failed (${report.exitCode}): ${report.stderr.trim()}`);
    if (!/^\s*Avail\s+\d+\s*$/.test(report.stdout)) throw new Error('Invalid df available-byte output');
    return report.stdout;
  }
  async function persist(): Promise<void> {
    if (!result.logPath) return;
    const temporary = `${result.logPath}.new`;
    await writeFile(temporary, JSON.stringify(result, null, 2), { flag: 'wx' });
    await rename(temporary, result.logPath);
  }
  try {
    result.before = await capacity();
    result.freeBeforeBytes = Number(result.before.trim().split(/\s+/).at(-1));
    await persist();
    for (const action of manifest.actions) {
      await validate(action);
      const processes = await inspectNativeProcesses([action.path], recordedRunner);
      if (processes.active.length) {
        result.preserved.push({ path: action.path, reason: 'Became active since review' });
        await persist();
        continue;
      }
      await validate(action);
      const removal = await recordedRunner(['rm', '-r', '--', action.path]);
      if (removal.exitCode !== 0)
        throw new Error(`rm failed (${removal.exitCode}) for ${action.path}: ${removal.stderr.trim()}`);
      await ensureAbsent(action.path);
      result.removed.push(action.path);
      await persist();
    }
  } catch (error) {
    result.failure = String(error);
  }
  try {
    result.after = await capacity();
    result.freeAfterBytes = Number(result.after.trim().split(/\s+/).at(-1));
    result.reclaimedBytes = result.freeBeforeBytes === null ? null : result.freeAfterBytes - result.freeBeforeBytes;
    for (const scope of manifest.scopes) {
      if (scope.path !== root) await validatePath(root, scope.path);
      const newNames = (await readdir(scope.path)).filter((name) => !scope.entries.includes(name));
      result.newEntries.push(...newNames.map((name) => join(scope.path, name)));
    }
    for (const path of result.removed) await ensureAbsent(path);
  } catch (error) {
    result.failure = [result.failure, String(error)].filter(Boolean).join('; ');
  }
  await persist();
  return result;
}
