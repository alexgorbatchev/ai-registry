import { describe, expect, it, mock } from "bun:test";
import { createReviewerApi } from "../createReviewerApi";
import type { CommandEnvironment } from "../runCommand";

const credentials = { hostname: "github.com", token: "test-reviewer-token", environment: {
  GH_TOKEN: "test-implementer-token", GITHUB_TOKEN: "other-token", GH_DEBUG: "api",
} };

describe("reviewer API transport", () => {
  it("isolates bot credentials and sends JSON on stdin without switching gh accounts", async () => {
    const run = mock(async (_args: string[], _env: CommandEnvironment, _input?: string) => ({ code: 0, stdout: "HTTP/2.0 201 Created\r\nContent-Type: application/json\r\n\r\n{\"id\":7}", stderr: "" }));
    const api = createReviewerApi(credentials, run);
    expect(await api({ actor: "reviewer", method: "PUT", path: "repos/example/project/collaborators/review-bot", body: { permission: "push" } })).toEqual({ status: 201, body: { id: 7 } });
    expect(run.mock.calls[0]).toEqual([
      ["gh", "api", "--hostname", "github.com", "--method", "PUT", "--include", "--header", "Accept: application/vnd.github+json", "repos/example/project/collaborators/review-bot", "--input", "-"],
      { GH_TOKEN: "test-reviewer-token", GH_ENTERPRISE_TOKEN: "test-reviewer-token", GITHUB_TOKEN: undefined, GITHUB_ENTERPRISE_TOKEN: undefined,
        GH_HOST: "github.com", GH_DEBUG: undefined, GH_PROMPT_DISABLED: "1", GH_PAGER: "cat", NO_COLOR: "1" },
      '{"permission":"push"}',
    ]);
    await api({ actor: "implementer", method: "GET", path: "user" });
    expect(run.mock.calls[1]?.[1].GH_TOKEN).toBe("test-implementer-token");
    expect(credentials.environment.GH_TOKEN).toBe("test-implementer-token");
  });

  it.each([
    ["HTTP/2.0 204 No Content\n\n", 0, { status: 204 }],
    ["HTTP/2.0 404 Not Found\n\n{\"message\":\"Not Found\"}", 1, { status: 404, body: { message: "Not Found" } }],
  ])("parses HTTP results without confusing CLI exit codes with HTTP status: %s", async (stdout, code, expected) => {
    const api = createReviewerApi(credentials, async () => ({ code, stdout, stderr: "" }));
    expect(await api({ actor: "implementer", method: "GET", path: "user" })).toEqual(expected);
  });

  it.each([
    ["", 1, "GitHub request failed before an HTTP response (exit 1); check authentication, network, and CLI installation."],
    ["HTTP/2.0 200 OK\n\n{}", 1, "GitHub CLI failed (exit 1); response is incomplete."],
    ["HTTP/2.0 200 OK\n\nsecret response is not JSON", 0, "GitHub returned an invalid JSON response."],
  ])("redacts subprocess output on errors: %s", async (stdout, code, message) => {
    const api = createReviewerApi(credentials, async () => ({ code, stdout, stderr: "secret token in debug output" }));
    await expect(api({ actor: "implementer", method: "GET", path: "user" })).rejects.toThrow(message);
  });

  it("redacts spawn errors", async () => {
    const api = createReviewerApi(credentials, async () => Promise.reject(new Error("secret in environment")));
    await expect(api({ actor: "reviewer", method: "GET", path: "user" })).rejects.toThrow("Cannot execute gh; verify that GitHub CLI is installed and available.");
  });

  it("rejects URL-shaped hosts and empty tokens", () => {
    expect(() => createReviewerApi({ ...credentials, hostname: "https://github.com" })).toThrow("GitHub hostname must be a hostname, not a URL.");
    expect(() => createReviewerApi({ ...credentials, token: " " })).toThrow("Reviewer token is empty.");
  });
});
