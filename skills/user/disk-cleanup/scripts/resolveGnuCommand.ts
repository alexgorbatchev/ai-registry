const resolved = new Map<string, string>();

export function resolveGnuCommand(command: string): string {
  if (!['du', 'df', 'rm'].includes(command)) return command;
  const cached = resolved.get(command);
  if (cached) return cached;
  const candidates = process.platform === 'darwin' ? [`g${command}`, command] : [command, `g${command}`];
  for (const candidate of candidates) {
    const path = Bun.which(candidate);
    if (!path) continue;
    const probe = Bun.spawnSync([path, '--version'], { stdout: 'pipe', stderr: 'pipe' });
    if (probe.success && probe.stdout.toString().includes('GNU coreutils')) {
      resolved.set(command, path);
      return path;
    }
  }
  throw new Error(`GNU ${command} is required; install coreutils and put ${command} or g${command} on PATH`);
}
