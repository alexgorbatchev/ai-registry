import { describe, expect, it, mock } from "bun:test";
import assert from "node:assert/strict";
import { listOpenIssues } from "../listOpenIssues";
import type { IApiRequest, IApiResponse } from "../ensureReviewer";

const issue = { number: 2, title: "Second", created_at: "2026-01-02T00:00:00Z", html_url: "https://github.com/example/project/issues/2" };

describe("open issue listing", () => {
  it("paginates, excludes PRs, and orders oldest first with number as a tie-breaker", async () => {
    const responses: IApiResponse[] = [
      { status: 200, body: Array.from({ length: 100 }, (_, index) => ({ ...issue, number: 100 + index, pull_request: { url: "example" } })) },
      { status: 200, body: [issue, { ...issue, number: 3, title: "Third" }, { number: 1, title: "First", created_at: "2026-01-01T00:00:00Z", html_url: "https://github.com/example/project/issues/1" }] },
    ];
    const api = mock(async (_request: IApiRequest) => {
      const response = responses.shift();
      assert(response, "Unexpected request");
      return response;
    });
    expect(await listOpenIssues("example/project", api)).toEqual([
      { number: 1, title: "First", createdAt: "2026-01-01T00:00:00Z", url: "https://github.com/example/project/issues/1" },
      { number: 2, title: "Second", createdAt: "2026-01-02T00:00:00Z", url: issue.html_url },
      { number: 3, title: "Third", createdAt: "2026-01-02T00:00:00Z", url: issue.html_url },
    ]);
    expect(api.mock.calls.map(([request]) => request.path)).toEqual([
      "repos/example/project/issues?state=open&sort=created&direction=asc&per_page=100&page=1",
      "repos/example/project/issues?state=open&sort=created&direction=asc&per_page=100&page=2",
    ]);
  });

  it.each([
    [{ status: 403 }, "GitHub list request failed (HTTP 403)."],
    [{ status: 200, body: {} }, "GitHub returned an invalid list."],
    [{ status: 200, body: [null] }, "GitHub returned an invalid object."],
    [{ status: 200, body: [{ ...issue, number: 0 }] }, "GitHub returned an invalid issue number."],
    [{ status: 200, body: [{ ...issue, title: "" }] }, "GitHub response is missing title."],
  ])("rejects incomplete results: %j", async (response, message) => {
    await expect(listOpenIssues("example/project", async () => response)).rejects.toThrow(message);
  });
});
