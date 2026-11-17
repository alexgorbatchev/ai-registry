import { shellEnvSync } from "shell-env";

export type ILoadShellEnvironment = () => Record<string, string | undefined>;

type IRunCommand = (command: string[]) => { exitCode: number; stdout: string };
type IReadAccountShell = () => string | null;
type IStartShellEnvironment = (shell?: string) => Record<string, string | undefined>;

const runCommand: IRunCommand = (command) => {
  const result = Bun.spawnSync(command, { stdout: "pipe", stderr: "ignore" });
  return { exitCode: result.exitCode, stdout: result.stdout.toString() };
};

// The account's login shell from the system's user database. Bun's
// os.userInfo().shell echoes $SHELL instead, which cron sets to /bin/sh.
export function readAccountShell(
  platform: NodeJS.Platform = process.platform,
  uid: number | null = process.getuid?.() ?? null,
  run: IRunCommand = runCommand,
): string | null {
  if (uid === null) {
    return null;
  }
  try {
    if (platform === "darwin") {
      const name = run(["id", "-un", String(uid)]).stdout.trim();
      const record = run(["dscl", ".", "-read", `/Users/${name}`, "UserShell"]);
      return record.exitCode === 0 ? (/^UserShell:\s*(\S+)/m.exec(record.stdout)?.[1] ?? null) : null;
    }
    const entry = run(["getent", "passwd", String(uid)]);
    return entry.exitCode === 0 ? entry.stdout.trim().split(":")[6] || null : null;
  } catch {
    return null;
  }
}

// Cron starts jobs with SHELL=/bin/sh, whose startup files never export what the
// user's own shell does. Start the account's login shell instead, and fall back to
// SHELL detection only when the user database names no shell.
export function loadLoginShellEnvironment(
  readShell: IReadAccountShell = () => readAccountShell(),
  startShellEnvironment: IStartShellEnvironment = shellEnvSync,
): Record<string, string | undefined> {
  let accountShell: string | null;
  try {
    accountShell = readShell();
  } catch {
    accountShell = null;
  }
  return startShellEnvironment(accountShell || undefined);
}

// Template `env()` lookups read the build's own environment first. A variable it
// lacks, such as a key that only interactive shell startup files export and that a
// cron job's non-interactive shell never loads, comes from the user's login shell,
// which is started at most once per build and only when a template needs it.
export function createTemplateEnvironment(
  processEnvironment: NodeJS.ProcessEnv,
  loadShellEnvironment: ILoadShellEnvironment = loadLoginShellEnvironment,
): NodeJS.ProcessEnv {
  let shellEnvironment: Record<string, string | undefined> | undefined;

  return new Proxy(processEnvironment, {
    get(target, name, receiver) {
      const value: unknown = Reflect.get(target, name, receiver);
      if (value !== undefined || typeof name !== "string") {
        return value;
      }
      shellEnvironment ??= loadShellEnvironment();
      return shellEnvironment[name];
    },
  });
}
