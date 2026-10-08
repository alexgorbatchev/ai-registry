import { listPages, object, textField, type ReviewerApi } from "./ensureReviewer";

export interface IOpenIssue {
  number: number;
  title: string;
  createdAt: string;
  url: string;
}

export async function listOpenIssues(repo: string, api: ReviewerApi): Promise<IOpenIssue[]> {
  const entries = await listPages(api, "implementer", `repos/${repo}/issues?state=open&sort=created&direction=asc`);
  return entries.map(object).filter(entry => !entry.pull_request).map(entry => {
    if (typeof entry.number !== "number" || !Number.isSafeInteger(entry.number) || entry.number < 1) {
      throw new Error("GitHub returned an invalid issue number.");
    }
    return { number: entry.number, title: textField(entry, "title"),
      createdAt: textField(entry, "created_at"), url: textField(entry, "html_url") };
  }).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.number - right.number);
}
