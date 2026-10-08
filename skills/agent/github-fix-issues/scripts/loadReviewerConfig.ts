import { runCommand, type CommandRunner, type CommandEnvironment } from "./runCommand";

export interface IReviewerFlags {
  repo?: string;
  reviewer?: string;
  tokenEnv?: string;
  hostname?: string;
  pr?: string;
  issues: boolean;
}

export interface IReviewerConfig {
  repo: string;
  reviewer: string;
  hostname: string;
  token: string;
  pr?: number;
  issues: boolean;
}

export async function loadReviewerConfig(flags: IReviewerFlags, env: CommandEnvironment, run: CommandRunner = runCommand): Promise<IReviewerConfig> {
  async function config(key: string): Promise<string | undefined> {
    const result = await run(["git", "config", "--get", `github-fix-issues.${key}`], env);
    if (result.code === 1) return undefined;
    if (result.code !== 0) throw new Error("Cannot read reviewer Git configuration.");
    return result.stdout.trim() || undefined;
  }
  const reviewer = flags.reviewer ?? env.GH_REVIEWER_LOGIN ?? await config("reviewer");
  const tokenEnv = flags.tokenEnv ?? env.GH_REVIEWER_TOKEN_ENV ?? await config("tokenEnv");
  if (!reviewer || !tokenEnv) {
    throw new Error("Set github-fix-issues.reviewer and github-fix-issues.tokenEnv in Git config, or supply --reviewer and --token-env. Store only the token variable name in config.");
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tokenEnv)) throw new Error("Token environment variable name is invalid.");
  const token = env[tokenEnv];
  if (!token?.trim()) throw new Error(`Reviewer token environment variable ${tokenEnv} is not set.`);
  const hostname = flags.hostname ?? env.GH_HOST ?? "github.com";
  let repo = flags.repo;
  if (!repo) {
    const detected = await run(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
      { ...env, GH_HOST: hostname, GH_DEBUG: undefined, GH_PROMPT_DISABLED: "1" });
    if (detected.code !== 0) throw new Error("Cannot detect the repository; supply --repo OWNER/REPO.");
    repo = detected.stdout.trim();
  }
  const pr = flags.pr === undefined ? undefined : Number(flags.pr);
  if (pr !== undefined && (!/^\d+$/.test(flags.pr ?? "") || !Number.isSafeInteger(pr) || pr < 1)) throw new Error("PR number must be a positive integer.");
  return { repo, reviewer, hostname, token, pr, issues: flags.issues };
}
