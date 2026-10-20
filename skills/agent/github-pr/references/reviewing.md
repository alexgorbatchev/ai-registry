## Workflow

1. Identify the PR: use the number the user gives, otherwise the open PR for the current branch. When neither resolves to exactly one PR, list the account owner's open PRs and match the user's description; ask only when several still match.
2. Fetch all feedback with `gh api --paginate` and save the raw JSON under `.tmp/pr-<number>/`. Read all three sources; each holds feedback the others omit:
   - Inline review comments: `repos/{owner}/{repo}/pulls/{number}/comments`
   - Conversation comments: `repos/{owner}/{repo}/issues/{number}/comments`
   - Review submissions and their bodies: `repos/{owner}/{repo}/pulls/{number}/reviews`
3. Acknowledge feedback before evaluating it: add an `eyes` reaction to every inline review comment and conversation comment, using the matching endpoint from the [reactions API](https://docs.github.com/en/rest/reactions/reactions):
   - Inline review comment: `POST repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions -f content=eyes`
   - Conversation comment: `POST repos/{owner}/{repo}/issues/comments/{comment_id}/reactions -f content=eyes`

   Review submissions have no reactions endpoint; read their bodies without reacting. A `200` response means the reaction already existed and `201` means it was created; treat both as acknowledged and report any other status.
4. Evaluate each comment against ground truth before forming a position. Read the code it targets on the PR head and verify every factual claim with the relevant source: the base branch for "already exists" questions, installed dependency versions and their exports for "use the library's X" suggestions, and the diff for duplication or design concerns. Classify each comment as valid, partially valid, or not applicable, with the evidence behind the classification.
5. Report to the user with one short entry per comment: who raised what, whether it holds up, and the recommended response. Describe behavior and design in plain language without file paths, line numbers, or code snippets. Close with any issues found in the PR that reviewers did not raise.
6. Wait for the user's direction before replying, resolving threads, or changing code.
