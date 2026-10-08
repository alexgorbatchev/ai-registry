export type ReviewerActor = "implementer" | "reviewer";

export interface IApiRequest {
  actor: ReviewerActor;
  method: "GET" | "PUT" | "PATCH";
  path: string;
  body?: Record<string, string>;
}

export interface IApiResponse {
  status: number;
  body?: unknown;
}

export type ReviewerApi = (request: IApiRequest) => Promise<IApiResponse>;

export interface IReviewerOptions {
  repo: string;
  reviewer: string;
  pr?: number;
}

export interface IReviewerResult {
  repo: string;
  implementer: string;
  reviewer: string;
  author: string | null;
  access: "existing" | "accepted" | "invited-and-accepted" | "granted";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error("GitHub returned an invalid object.");
  }
  return value;
}

export function textField(value: unknown, key: string): string {
  const field = object(value)[key];
  if (typeof field !== "string" || !field) throw new Error(`GitHub response is missing ${key}.`);
  return field;
}

export function requireStatus(response: IApiResponse, expected: number, operation: string): void {
  if (response.status !== expected) throw new Error(`${operation} failed (HTTP ${response.status}).`);
}

export async function listPages(api: ReviewerApi, actor: ReviewerActor, path: string): Promise<unknown[]> {
  const results: unknown[] = [];
  const separator = path.includes("?") ? "&" : "?";
  for (let page = 1; ; page++) {
    const response = await api({ actor, method: "GET", path: `${path}${separator}per_page=100&page=${page}` });
    requireStatus(response, 200, "GitHub list request");
    if (!Array.isArray(response.body)) throw new Error("GitHub returned an invalid list.");
    const entries: unknown[] = response.body;
    results.push(...entries);
    if (entries.length < 100) return results;
  }
}

function same(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

async function pendingInvitation(api: ReviewerApi, options: IReviewerOptions): Promise<Record<string, unknown> | undefined> {
  const entries = await listPages(api, "reviewer", "user/repository_invitations");
  const matches = entries.map(object).filter(entry =>
    same(textField(entry.repository, "full_name"), options.repo)
    && same(textField(entry.invitee, "login"), options.reviewer));
  if (matches.length > 1) throw new Error("Multiple matching reviewer invitations; resolve them before retrying.");
  return matches[0];
}

/** Ensure access using only the two explicitly selected identities and repository. */
export async function ensureReviewer(options: IReviewerOptions, api: ReviewerApi): Promise<IReviewerResult> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repo)) throw new Error("Repository must be OWNER/REPO.");
  if (!/^[A-Za-z0-9-]+$/.test(options.reviewer)) throw new Error("Reviewer must be a GitHub login.");
  if (options.pr !== undefined && (!Number.isSafeInteger(options.pr) || options.pr < 1)) throw new Error("PR number must be a positive integer.");
  const implementerResponse = await api({ actor: "implementer", method: "GET", path: "user" });
  requireStatus(implementerResponse, 200, "Implementer authentication");
  const implementer = textField(implementerResponse.body, "login");
  const reviewerResponse = await api({ actor: "reviewer", method: "GET", path: "user" });
  requireStatus(reviewerResponse, 200, "Reviewer authentication");
  const reviewer = textField(reviewerResponse.body, "login");
  if (!same(reviewer, options.reviewer)) throw new Error(`Reviewer login mismatch: expected ${options.reviewer}, received ${reviewer}.`);
  if (same(reviewer, implementer)) throw new Error("Reviewer must differ from the implementing identity.");

  const repoPath = `repos/${options.repo}`;
  const repoResponse = await api({ actor: "implementer", method: "GET", path: repoPath });
  requireStatus(repoResponse, 200, "Implementer repository access");
  const repo = object(repoResponse.body);
  if (!same(textField(repo, "full_name"), options.repo)) throw new Error("Repository identity does not match the request.");
  const permissions = object(repo.permissions);
  if (permissions.push !== true) throw new Error("Implementer needs repository write access to check collaborator membership.");
  const ownerType = textField(repo.owner, "type");
  if (ownerType !== "User" && ownerType !== "Organization") throw new Error("Unsupported repository owner type.");

  let author: string | null = null;
  if (options.pr !== undefined) {
    const prResponse = await api({ actor: "implementer", method: "GET", path: `${repoPath}/pulls/${options.pr}` });
    requireStatus(prResponse, 200, "PR author lookup");
    author = textField(object(prResponse.body).user, "login");
    if (same(reviewer, author)) throw new Error(`Reviewer must differ from PR author ${author}.`);
  }

  const collaboratorPath = `${repoPath}/collaborators/${reviewer}`;
  const membership = await api({ actor: "implementer", method: "GET", path: collaboratorPath });
  let access: IReviewerResult["access"] = "existing";
  if (membership.status !== 204) {
    if (membership.status !== 404) throw new Error(`Collaborator check failed (HTTP ${membership.status}); no invitation was sent.`);
    let invitation = await pendingInvitation(api, options);
    access = "accepted";
    if (!invitation) {
      if (permissions.admin !== true) throw new Error("Inviting the reviewer requires repository administration access.");
      const outstanding = await listPages(api, "implementer", `${repoPath}/invitations`);
      if (outstanding.some(entry => same(textField(object(entry).invitee, "login"), reviewer))) {
        throw new Error("Repository invitation exists but is not visible to the reviewer; check the bot token's invitation access and retry.");
      }
      const addition = await api({ actor: "implementer", method: "PUT", path: collaboratorPath,
        body: ownerType === "Organization" ? { permission: "push" } : {} });
      if (addition.status === 204) {
        access = "granted";
      } else {
        requireStatus(addition, 201, "Reviewer invitation");
        invitation = await pendingInvitation(api, options);
        if (!invitation || invitation.id !== object(addition.body).id) {
          throw new Error("Created invitation is not visible to the reviewer; rerun to resume without creating another invitation.");
        }
        access = "invited-and-accepted";
      }
    }
    if (invitation) {
      if (invitation.permissions !== "write") throw new Error("Pending invitation must grant write access; no permission change was made.");
      const id = invitation.id;
      if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) throw new Error("GitHub returned an invalid invitation ID.");
      const accepted = await api({ actor: "reviewer", method: "PATCH", path: `user/repository_invitations/${id}` });
      requireStatus(accepted, 204, "Reviewer invitation acceptance");
    }
    const verified = await api({ actor: "implementer", method: "GET", path: collaboratorPath });
    if (verified.status !== 204) throw new Error(`Membership verification failed (HTTP ${verified.status}); rerun after access propagates.`);
  }
  const botRepo = await api({ actor: "reviewer", method: "GET", path: repoPath });
  requireStatus(botRepo, 200, "Reviewer repository access");
  if (object(object(botRepo.body).permissions).push !== true) throw new Error("Reviewer needs repository write access; existing permissions were not changed.");
  return { repo: options.repo, implementer, reviewer, author, access };
}
