import { Command, InvalidArgumentError } from 'commander';
import skillText from '../SKILL.md' with { type: 'text' };
import { resolveRoot, run } from './filesystemUtils';
import { inspectStaleFolders } from './inspectFolders';
import { inspectWorktrees, validateWorktree } from './inspectWorktrees';
import { inspectDependencies } from './inventory';
import { removeTargets, validateCache, validateDependency, worktreeAction } from './removeTargets';
import type { Action, DependencyOptions, DiskOptions, FolderOptions, RunOptions, TimeMode } from './types';

const isAgent = ['1', 'true', 'yes'].includes(Bun.env.AGENT?.trim().toLowerCase() ?? '');
const program = new Command().name('cleanup').description('Inspect disk use and remove selected development artifacts');

function positiveInteger(value: string): number {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1) {
    throw new InvalidArgumentError('Expected a positive integer');
  }
  return number;
}

function output(value: unknown): void {
  console.log(JSON.stringify(value, null, isAgent ? undefined : 2));
}

function scoped(command: Command, canExecute: boolean = false): Command {
  command.option('--root <directory>', 'Directory to inspect and contain every deletion', '.');
  if (canExecute) command.option('--execute', 'Delete the validated targets; otherwise preview', false);
  return command;
}

program
  .command('skill')
  .description('Print the complete operating reference')
  .action(async () => {
    await Bun.write(Bun.stdout, skillText);
  });

const disk = program.command('disk').description('Measure allocated space');
scoped(disk.command('inspect').description('Report filesystem capacity and largest folders'))
  .option('--depth <levels>', 'Directory depth to report', positiveInteger, 2)
  .action(async (options: DiskOptions) => {
    const root = await resolveRoot(options.root);
    const filesystem = await run(['df', '-B1', '--', root]);
    const usage = await run(['du', '-x', '-B1', '--null', `--max-depth=${options.depth}`, '--', root]);
    const folders = usage
      .split('\0')
      .filter(Boolean)
      .map((record) => {
        const separator = record.indexOf('\t');
        return { bytes: Number(record.slice(0, separator)), path: record.slice(separator + 1) };
      })
      .sort((left, right) => right.bytes - left.bytes);
    output({ root, filesystem, folders });
  });

const folders = program.command('folders').description('Find directories exceeding size and staleness thresholds');
scoped(folders.command('list').description('List stale folders by size and last modified/accessed timestamps'))
  .option('--size <size>', 'Minimum folder size threshold (e.g. 1G, 1.5, 500M)', '1G')
  .option('--days <count>', 'Staleness threshold in days', positiveInteger, 30)
  .option('--time <mode>', 'Timestamp basis: either (neither touched), modified (mtime), accessed (atime)', 'either')
  .option('--depth <levels>', 'Maximum directory search depth', positiveInteger)
  .option('--no-prune', 'Do not prune nested matches when an ancestor folder is also stale and large')
  .action(async (options: FolderOptions) => {
    const root = await resolveRoot(options.root);
    const normalizedTime = (options.time ?? 'either').toLowerCase();
    let selectedTimeMode: TimeMode = 'either';
    if (normalizedTime === 'mtime' || normalizedTime === 'modified') {
      selectedTimeMode = 'modified';
    } else if (normalizedTime === 'atime' || normalizedTime === 'accessed') {
      selectedTimeMode = 'accessed';
    } else if (normalizedTime === 'either' || normalizedTime === 'both') {
      selectedTimeMode = 'either';
    } else {
      throw new InvalidArgumentError(`Invalid time mode: "${options.time}". Choose from: either, modified, accessed.`);
    }

    const report = await inspectStaleFolders({
      root,
      size: options.size,
      days: options.days,
      time: selectedTimeMode,
      depth: options.depth,
      prune: options.prune,
    });
    output({ root, size: options.size, days: options.days, time: selectedTimeMode, folders: report });
  });

const dependencies = program.command('dependencies').description('Review dependencies in inactive Git projects');
for (const verb of ['list', 'remove']) {
  scoped(
    dependencies
      .command(verb)
      .description(
        verb === 'list'
          ? 'List dependency sizes and inactivity decisions'
          : 'Preview or remove dependencies from inactive projects',
      ),
    verb === 'remove',
  )
    .option('--days <count>', 'Required days without recorded Git activity', positiveInteger, 30)
    .action(async (options: DependencyOptions) => {
      const root = await resolveRoot(options.root);
      const report = await inspectDependencies(root, options.days);
      if (verb === 'list') return output({ root, days: options.days, dependencies: report });
      const actions: Action[] = report
        .filter((item) => item.eligible)
        .map((item) => ({
          path: item.path,
          repository: item.repository,
          bytes: item.bytes,
          kind: 'dependency',
        }));
      const result = await removeTargets({ root, execute: options.execute }, actions, (action) =>
        validateDependency(root, action, options.days),
      );
      output({ result, preserved: report.filter((item) => !item.eligible) });
    });
}

const paths = program.command('paths').description('Review explicitly selected caches and temporary files');
scoped(
  paths
    .command('remove')
    .description('Preview or delete the named artifact paths')
    .argument('<paths...>', 'Paths relative to root, or absolute paths inside root'),
  true,
).action(async (inputs: string[], options: RunOptions) => {
  const root = await resolveRoot(options.root);
  const actions: Action[] = [];
  for (const input of inputs) actions.push(await validateCache(root, input));
  output(
    await removeTargets({ root, execute: options.execute }, actions, async (action) => {
      await validateCache(root, action.path);
    }),
  );
});

const worktrees = program.command('worktrees').description('Review registered worktrees and workspace directories');
scoped(worktrees.command('list').description('List sizes, registration, branches, locks, and file status')).action(
  async (options: RunOptions) => {
    const root = await resolveRoot(options.root);
    const report = await inspectWorktrees(root);
    output({ root, ...report });
    if (report.errors.length > 0) process.exitCode = 1;
  },
);
scoped(
  worktrees
    .command('remove')
    .description('Preview or remove the named empty-of-changes linked worktrees')
    .argument('<paths...>', 'Exact linked worktree paths'),
  true,
).action(async (inputs: string[], options: RunOptions) => {
  const root = await resolveRoot(options.root);
  const actions: Action[] = [];
  for (const input of inputs) actions.push(await worktreeAction(root, input));
  output(
    await removeTargets({ root, execute: options.execute }, actions, async (action) => {
      if (!action.repository) throw new Error('Worktree has no Git owner');
      await validateWorktree(root, action.path, action.repository);
    }),
  );
});

if (isAgent)
  program.addHelpText('beforeAll', 'ALERT: Agents must read `AGENT=1 cleanup skill` before using this tool.\n');

function configureHelp(command: Command): void {
  command.configureHelp({
    formatHelp: (current, helper) => {
      const width = process.stdout.columns || 100;
      const lines = [`Usage: ${helper.commandUsage(current)}`, '', current.description(), ''];
      function tree(parent: Command, prefix: string): void {
        const children = helper.visibleCommands(parent);
        for (const [index, child] of children.entries()) {
          const isLast = index === children.length - 1;
          const marker = isAgent ? '* ' : isLast ? '╰─ ' : '├─ ';
          const label = `${prefix}${marker}${helper.subcommandTerm(child)}`;
          lines.push(isAgent ? `${label}: ${child.description()}` : `${label.padEnd(36)} ${child.description()}`);
          tree(child, `${prefix}${isAgent ? '  ' : isLast ? '   ' : '│  '}`);
        }
      }
      tree(current, '');
      for (const option of helper.visibleOptions(current)) {
        lines.push(`${helper.optionTerm(option)}: ${helper.optionDescription(option)}`);
      }
      return (
        lines.map((line) => (isAgent || line.length <= width ? line : `${line.slice(0, width - 3)}...`)).join('\n') +
        '\n'
      );
    },
  });
  for (const child of command.commands) configureHelp(child);
}

configureHelp(program);
try {
  await program.parseAsync();
} catch (error) {
  console.error(isAgent && error instanceof Error ? error.stack : `Error: ${String(error)}`);
  process.exitCode = 1;
}
