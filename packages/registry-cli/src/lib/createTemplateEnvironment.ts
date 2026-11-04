import { shellEnvSync } from "shell-env";

export type ILoadShellEnvironment = () => Record<string, string | undefined>;

// Template `env()` lookups read the build's own environment first. A variable it
// lacks, such as a key that only interactive shell startup files export and that a
// cron job's non-interactive shell never loads, comes from the user's login shell,
// which is started at most once per build and only when a template needs it.
export function createTemplateEnvironment(
  processEnvironment: NodeJS.ProcessEnv,
  loadShellEnvironment: ILoadShellEnvironment = shellEnvSync,
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
