import { readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ensureAbsent, isRecordPath, isWithin, validatePath } from './filesystemUtils';
import { assertDisjoint } from './inventory';
import { inspectNativeProcesses } from './inspectNativeProcesses';
import { readNativeManifest } from './readNativeManifest';
import { createNativeLog, inspectNativeTarget } from './reviewNativeTargets';
import { runInspectionCommand } from './runInspectionCommand';
import type { NativeAction, NativeHardlinks, NativeRemoval } from './nativeTypes';
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
  if (manifest.actions.some((action) => isRecordPath(root, action.path) || isWithin(action.path, manifestPath))) {
    throw new Error('Cleanup would remove its manifest or execution logs');
  }
  const parents = new Set([...manifest.actions, ...manifest.preserved].map((entry) => dirname(entry.path)));
  if (manifest.scopes.length !== parents.size || manifest.scopes.some((scope) => !parents.delete(scope.path))) {
    throw new Error('Manifest scopes do not match the reviewed target parents');
  }
  for (const scope of manifest.scopes) if (scope.path !== root) await validatePath(root, scope.path);
  const hardlinkState: NativeHardlinks = { baseline: new Map(), removed: new Map() };
  const targetLinks = new Map<string, string[]>();
  const targetInodes = new Map<string, string[]>();
  async function validate(action: NativeAction): Promise<void> {
    const inspection = await inspectNativeTarget(root, action.path, execute ? hardlinkState : undefined);
    if (inspection.identity !== action.identity) throw new Error(`Target changed since review: ${action.path}`);
    targetLinks.set(action.path, inspection.hardlinks);
    targetInodes.set(action.path, inspection.inodes);
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
    for (const batch of nativeBatches(manifest.actions)) {
      const processes = await inspectNativeProcesses(
        batch.map((action) => action.path),
        recordedRunner,
        targetInodes,
      );
      const active = new Set(processes.active);
      const idle = batch.filter((action) => !active.has(action.path));
      for (const path of processes.active) result.preserved.push({ path, reason: 'Became active since review' });
      // Validate the whole idle batch after the snapshot, before launching a single removal command.
      for (const action of idle) await validate(action);
      await persist();
      if (!idle.length) continue;
      const failures: string[] = [];
      try {
        const removal = await recordedRunner(['rm', '-r', '--', ...idle.map((action) => action.path)]);
        if (removal.exitCode !== 0)
          failures.push(`rm failed (${removal.exitCode}) for batch: ${removal.stderr.trim()}`);
      } catch (error) {
        failures.push(`Removal command failed: ${String(error)}`);
      }
      // rm can remove some operands even when it fails. Reconcile all of them before stopping.
      for (const action of idle) {
        try {
          await ensureAbsent(action.path);
          result.removed.push(action.path);
          for (const key of targetLinks.get(action.path) ?? [])
            hardlinkState.removed.set(key, (hardlinkState.removed.get(key) ?? 0) + 1);
        } catch (error) {
          failures.push(String(error));
        }
      }
      if (failures.length) throw new Error(failures.join('; '));
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

function* nativeBatches(actions: NativeAction[]): Generator<NativeAction[]> {
  let batch: NativeAction[] = [];
  let bytes = 0;
  for (const action of actions) {
    const pathBytes = Buffer.byteLength(action.path) + 1;
    if (pathBytes > 16384) throw new Error(`Target path exceeds batch argument limit: ${action.path}`);
    if (batch.length && (batch.length === 32 || bytes + pathBytes > 16384)) {
      yield batch;
      batch = [];
      bytes = 0;
    }
    batch.push(action);
    bytes += pathBytes;
  }
  if (batch.length) yield batch;
}
