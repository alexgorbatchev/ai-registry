import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export function systemAssessmentRoots(
  platform: string = process.platform,
  home: string = homedir(),
  temporary: string = tmpdir(),
): string[] {
  if (platform === 'darwin')
    return [temporary, join(dirname(temporary), 'X'), join(home, 'Library/Caches'), '/Library', '/private/var/log'];
  if (platform === 'linux') return [temporary, '/var/tmp', '/var/cache', '/var/log', join(home, '.cache')];
  throw new Error(`System assessment is unsupported on ${platform}; select explicit roots`);
}
