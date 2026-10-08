import type { IApiResponse, ReviewerApi } from "./ensureReviewer";
import { runCommand, type CommandRunner, type CommandEnvironment } from "./runCommand";

export interface IReviewerCredentials {
  hostname: string;
  token: string;
  environment: CommandEnvironment;
}

/** Use separate subprocess environments; never change the implementer's login. */
export function createReviewerApi(credentials: IReviewerCredentials, run: CommandRunner = runCommand): ReviewerApi {
  if (!credentials.token.trim()) throw new Error("Reviewer token is empty.");
  if (!/^[A-Za-z0-9.-]+$/.test(credentials.hostname)) throw new Error("GitHub hostname must be a hostname, not a URL.");
  return async request => {
    const env: CommandEnvironment = {
      ...credentials.environment, GH_HOST: credentials.hostname, GH_PROMPT_DISABLED: "1",
      GH_DEBUG: undefined, GH_PAGER: "cat", NO_COLOR: "1",
    };
    if (request.actor === "reviewer") {
      env.GH_TOKEN = credentials.token;
      env.GH_ENTERPRISE_TOKEN = credentials.token;
      env.GITHUB_TOKEN = undefined;
      env.GITHUB_ENTERPRISE_TOKEN = undefined;
    }
    const args = ["gh", "api", "--hostname", credentials.hostname, "--method", request.method,
      "--include", "--header", "Accept: application/vnd.github+json", request.path];
    let input: string | undefined;
    if (request.body !== undefined) {
      args.push("--input", "-");
      input = JSON.stringify(request.body);
    }
    let result;
    try {
      result = await run(args, env, input);
    } catch {
      throw new Error("Cannot execute gh; verify that GitHub CLI is installed and available.");
    }
    const raw = result.stdout.replaceAll("\r\n", "\n");
    const status = /^HTTP\/\S+ (\d{3})\b/.exec(raw);
    const boundary = raw.indexOf("\n\n");
    if (!status || boundary < 0) {
      throw new Error(`GitHub request failed before an HTTP response (exit ${result.code}); check authentication, network, and CLI installation.`);
    }
    const response: IApiResponse = { status: Number(status[1]) };
    if (result.code !== 0 && response.status < 400) throw new Error(`GitHub CLI failed (exit ${result.code}); response is incomplete.`);
    const body = raw.slice(boundary + 2).trim();
    if (body) {
      try {
        const parsed: unknown = JSON.parse(body);
        response.body = parsed;
      } catch {
        throw new Error("GitHub returned an invalid JSON response.");
      }
    }
    return response;
  };
}
