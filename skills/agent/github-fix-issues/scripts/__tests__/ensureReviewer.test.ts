import { describe, expect, it, mock } from "bun:test";
import assert from "node:assert/strict";
import { ensureReviewer, type IApiResponse, type IApiRequest } from "../ensureReviewer";

const repository = { full_name: "example/project", owner: { type: "Organization" }, permissions: { push: true, admin: true } };
const invitation = { id: 7, repository: { full_name: "example/project" }, invitee: { login: "review-bot" }, permissions: "write" };

function apiSequence(responses: IApiResponse[]) {
  const pending = [...responses];
  return mock(async (_request: IApiRequest): Promise<IApiResponse> => {
    const response = pending.shift();
    assert(response, "Unexpected API request");
    return response;
  });
}

function identityResponses(): IApiResponse[] {
  return [
    { status: 200, body: { login: "implementer" } },
    { status: 200, body: { login: "review-bot" } },
    { status: 200, body: repository },
  ];
}

describe("ensureReviewer", () => {
  it("does not mutate an existing collaborator and verifies access with the bot credentials", async () => {
    const api = apiSequence([...identityResponses(), { status: 204 }, { status: 200, body: repository }]);
    expect(await ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).toEqual({
      repo: "example/project", implementer: "implementer", reviewer: "review-bot", author: null, access: "existing",
    });
    expect(api.mock.calls.map(([request]) => request)).toEqual([
      { actor: "implementer", method: "GET", path: "user" },
      { actor: "reviewer", method: "GET", path: "user" },
      { actor: "implementer", method: "GET", path: "repos/example/project" },
      { actor: "implementer", method: "GET", path: "repos/example/project/collaborators/review-bot" },
      { actor: "reviewer", method: "GET", path: "repos/example/project" },
    ]);
  });

  it("invites with push for organizations, accepts the matching invitation, and rechecks access", async () => {
    const api = apiSequence([...identityResponses(), { status: 404 }, { status: 200, body: [] }, { status: 200, body: [] },
      { status: 201, body: invitation }, { status: 200, body: [invitation] },
      { status: 204 }, { status: 204 }, { status: 200, body: repository }]);
    expect((await ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).access).toBe("invited-and-accepted");
    expect(api.mock.calls.slice(4).map(([request]) => request)).toEqual([
      { actor: "reviewer", method: "GET", path: "user/repository_invitations?per_page=100&page=1" },
      { actor: "implementer", method: "GET", path: "repos/example/project/invitations?per_page=100&page=1" },
      { actor: "implementer", method: "PUT", path: "repos/example/project/collaborators/review-bot", body: { permission: "push" } },
      { actor: "reviewer", method: "GET", path: "user/repository_invitations?per_page=100&page=1" },
      { actor: "reviewer", method: "PATCH", path: "user/repository_invitations/7" },
      { actor: "implementer", method: "GET", path: "repos/example/project/collaborators/review-bot" },
      { actor: "reviewer", method: "GET", path: "repos/example/project" },
    ]);
  });

  it("reuses an existing invitation without issuing PUT", async () => {
    const api = apiSequence([...identityResponses(), { status: 404 }, { status: 200, body: [invitation] },
      { status: 204 }, { status: 204 }, { status: 200, body: repository }]);
    expect((await ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).access).toBe("accepted");
    expect(api.mock.calls.map(([request]) => request.method)).toEqual(["GET", "GET", "GET", "GET", "GET", "PATCH", "GET", "GET"]);
  });

  it("does not mistake a forbidden collaborator check for missing membership", async () => {
    const api = apiSequence([...identityResponses(), { status: 403 }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).rejects.toThrow("Collaborator check failed (HTTP 403); no invitation was sent.");
    expect(api).toHaveBeenCalledTimes(4);
  });

  it("rejects an unexpected bot identity before touching repository access", async () => {
    const api = apiSequence([{ status: 200, body: { login: "implementer" } }, { status: 200, body: { login: "wrong-bot" } }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).rejects.toThrow("Reviewer login mismatch: expected review-bot, received wrong-bot.");
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("rejects the PR author even when the implementer identity is different", async () => {
    const api = apiSequence([...identityResponses(), { status: 200, body: { user: { login: "review-bot" } } }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot", pr: 12 }, api)).rejects.toThrow("Reviewer must differ from PR author review-bot.");
    expect(api).toHaveBeenCalledTimes(4);
  });

  it("does not return success when accepted membership is still absent", async () => {
    const api = apiSequence([...identityResponses(), { status: 404 }, { status: 200, body: [invitation] }, { status: 204 }, { status: 404 }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).rejects.toThrow("Membership verification failed (HTTP 404); rerun after access propagates.");
  });

  it("omits organization-only permission parameters for personal repositories", async () => {
    const personal = { ...repository, owner: { type: "User" } };
    const api = apiSequence([...identityResponses().slice(0, 2), { status: 200, body: personal },
      { status: 404 }, { status: 200, body: [] }, { status: 200, body: [] }, { status: 204 }, { status: 204 }, { status: 200, body: personal }]);
    expect((await ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).access).toBe("granted");
    expect(api.mock.calls[6]?.[0]).toEqual({ actor: "implementer", method: "PUT", path: "repos/example/project/collaborators/review-bot", body: {} });
  });

  it("does not issue another invitation when the bot cannot see the outstanding one", async () => {
    const api = apiSequence([...identityResponses(), { status: 404 }, { status: 200, body: [] }, { status: 200, body: [invitation] }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).rejects.toThrow("Repository invitation exists but is not visible to the reviewer; check the bot token's invitation access and retry.");
    expect(api.mock.calls.map(([request]) => request.method)).toEqual(["GET", "GET", "GET", "GET", "GET", "GET"]);
  });

  it("reports an invitation created but not yet visible to the bot", async () => {
    const api = apiSequence([...identityResponses(), { status: 404 }, { status: 200, body: [] }, { status: 200, body: [] }, { status: 201, body: invitation }, { status: 200, body: [] }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).rejects.toThrow("Created invitation is not visible to the reviewer; rerun to resume without creating another invitation.");
  });

  it("checks the PR author and returns the verified author", async () => {
    const api = apiSequence([...identityResponses(), { status: 200, body: { user: { login: "another-author" } } }, { status: 204 }, { status: 200, body: repository }]);
    expect((await ensureReviewer({ repo: "example/project", reviewer: "REVIEW-BOT", pr: 12 }, api)).author).toBe("another-author");
  });

  it("rejects duplicate invitations without accepting either", async () => {
    const api = apiSequence([...identityResponses(), { status: 404 }, { status: 200, body: [invitation, { ...invitation, id: 8 }] }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).rejects.toThrow("Multiple matching reviewer invitations; resolve them before retrying.");
  });

  it("ignores invitations for other repositories and accounts", async () => {
    const api = apiSequence([...identityResponses(), { status: 404 }, { status: 200, body: [
      { ...invitation, id: 3, repository: { full_name: "example/unrelated" } },
      { ...invitation, id: 4, invitee: { login: "unrelated-bot" } }, invitation,
    ] }, { status: 204 }, { status: 204 }, { status: 200, body: repository }]);
    await ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api);
    expect(api.mock.calls[5]?.[0].path).toBe("user/repository_invitations/7");
  });

  it.each([
    [{ ...invitation, permissions: "admin" }, "Pending invitation must grant write access; no permission change was made."],
    [{ ...invitation, id: 0 }, "GitHub returned an invalid invitation ID."],
  ])("rejects unsafe pending invitations: %j", async (pending, message) => {
    const api = apiSequence([...identityResponses(), { status: 404 }, { status: 200, body: [pending] }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).rejects.toThrow(message);
    expect(api).toHaveBeenCalledTimes(5);
  });

  it.each([
    [{ ...repository, permissions: { push: false, admin: false } }, "Implementer needs repository write access to check collaborator membership."],
    [{ ...repository, full_name: "example/wrong" }, "Repository identity does not match the request."],
    [{ ...repository, owner: { type: "Other" } }, "Unsupported repository owner type."],
  ])("rejects unsupported repository state before mutation: %j", async (repo, message) => {
    const api = apiSequence([{ status: 200, body: { login: "implementer" } }, { status: 200, body: { login: "review-bot" } }, { status: 200, body: repo }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).rejects.toThrow(message);
    expect(api).toHaveBeenCalledTimes(3);
  });

  it("does not escalate an existing bot's read-only access", async () => {
    const api = apiSequence([...identityResponses(), { status: 204 }, { status: 200, body: { permissions: { push: false } } }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).rejects.toThrow("Reviewer needs repository write access; existing permissions were not changed.");
  });

  it("rejects identical implementer and reviewer identities", async () => {
    const api = apiSequence([{ status: 200, body: { login: "REVIEW-BOT" } }, { status: 200, body: { login: "review-bot" } }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).rejects.toThrow("Reviewer must differ from the implementing identity.");
  });

  it("requires admin access only when a new invitation is needed", async () => {
    const api = apiSequence([{ status: 200, body: { login: "implementer" } }, { status: 200, body: { login: "review-bot" } },
      { status: 200, body: { ...repository, permissions: { push: true, admin: false } } }, { status: 404 }, { status: 200, body: [] }]);
    await expect(ensureReviewer({ repo: "example/project", reviewer: "review-bot" }, api)).rejects.toThrow("Inviting the reviewer requires repository administration access.");
  });

  it.each([
    [{ repo: "bad/repo/path", reviewer: "review-bot" }, "Repository must be OWNER/REPO."],
    [{ repo: "example/project", reviewer: "review/bot" }, "Reviewer must be a GitHub login."],
    [{ repo: "example/project", reviewer: "review-bot", pr: 0 }, "PR number must be a positive integer."],
  ])("rejects invalid input before querying GitHub: %j", async (options, message) => {
    const api = apiSequence([]);
    await expect(ensureReviewer(options, api)).rejects.toThrow(message);
    expect(api).not.toHaveBeenCalled();
  });
});
