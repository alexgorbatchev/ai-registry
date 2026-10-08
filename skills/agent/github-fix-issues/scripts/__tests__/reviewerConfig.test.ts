import { describe, expect, it, mock } from "bun:test";
import assert from "node:assert/strict";
import { loadReviewerConfig } from "../loadReviewerConfig";
import type { CommandEnvironment, ICommandResult } from "../runCommand";

const flags = { repo: "example/project", reviewer: "review-bot", tokenEnv: "BOT_TOKEN", issues: true };

function commandSequence(responses: ICommandResult[]) {
  const pending = [...responses];
  return mock(async (_args: string[], _env: CommandEnvironment): Promise<ICommandResult> => {
    const response = pending.shift();
    assert(response, "Unexpected command");
    return response;
  });
}

describe("reviewer configuration", () => {
  it("prefers explicit flags without probing Git config or shell aliases", async () => {
    const run = commandSequence([]);
    expect(await loadReviewerConfig({ ...flags, hostname: "git.example.test", pr: "42", issues: false },
      { BOT_TOKEN: "test-token", GH_REVIEWER_LOGIN: "ignored", GH_REVIEWER_TOKEN_ENV: "IGNORED", GH_HOST: "ignored" }, run)).toEqual({
      repo: "example/project", reviewer: "review-bot", hostname: "git.example.test", token: "test-token", pr: 42, issues: false,
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("uses environment configuration and detects the checkout repository", async () => {
    const run = commandSequence([{ code: 0, stdout: "example/project\n", stderr: "" }]);
    expect(await loadReviewerConfig({ issues: true }, { GH_REVIEWER_LOGIN: "review-bot", GH_REVIEWER_TOKEN_ENV: "BOT_TOKEN", BOT_TOKEN: "test-token" }, run)).toEqual({
      repo: "example/project", reviewer: "review-bot", hostname: "github.com", token: "test-token", pr: undefined, issues: true,
    });
    expect(run.mock.calls[0]?.[0]).toEqual(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  });

  it("reads just the two saved settings", async () => {
    const run = commandSequence([{ code: 0, stdout: "review-bot\n", stderr: "" }, { code: 0, stdout: "BOT_TOKEN\n", stderr: "" }]);
    expect((await loadReviewerConfig({ repo: "example/project", issues: true }, { BOT_TOKEN: "test-token" }, run)).reviewer).toBe("review-bot");
    expect(run.mock.calls.map(([args]) => args)).toEqual([
      ["git", "config", "--get", "github-fix-issues.reviewer"], ["git", "config", "--get", "github-fix-issues.tokenEnv"],
    ]);
  });

  it("reports missing configuration without scanning the environment", async () => {
    const run = commandSequence([{ code: 1, stdout: "", stderr: "" }, { code: 1, stdout: "", stderr: "" }]);
    await expect(loadReviewerConfig({ issues: true }, {}, run)).rejects.toThrow("Set github-fix-issues.reviewer and github-fix-issues.tokenEnv in Git config, or supply --reviewer and --token-env. Store only the token variable name in config.");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("reports Git configuration failure", async () => {
    const run = commandSequence([{ code: 128, stdout: "", stderr: "raw error" }]);
    await expect(loadReviewerConfig({ issues: true }, {}, run)).rejects.toThrow("Cannot read reviewer Git configuration.");
  });

  it("reports repository detection failure", async () => {
    const run = commandSequence([{ code: 1, stdout: "", stderr: "raw error" }]);
    await expect(loadReviewerConfig({ ...flags, repo: undefined }, { BOT_TOKEN: "test-token" }, run)).rejects.toThrow("Cannot detect the repository; supply --repo OWNER/REPO.");
  });

  it.each(["0", "-1", "1.5", "1e2", "abc", "9007199254740992"])("rejects invalid PR number %s", async pr => {
    await expect(loadReviewerConfig({ ...flags, pr }, { BOT_TOKEN: "test-token" }, commandSequence([]))).rejects.toThrow("PR number must be a positive integer.");
  });

  it("rejects missing tokens and invalid variable names", async () => {
    await expect(loadReviewerConfig(flags, {}, commandSequence([]))).rejects.toThrow("Reviewer token environment variable BOT_TOKEN is not set.");
    await expect(loadReviewerConfig({ ...flags, tokenEnv: "$(printenv)" }, {}, commandSequence([]))).rejects.toThrow("Token environment variable name is invalid.");
  });
});
