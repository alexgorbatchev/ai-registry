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
5. Evaluate the complete PR review, then present one review item at a time. Include all questions and proposed actions for that item together; wait for the user's decision or instruction to move on before presenting the next item. Queue approved actions and continue the review without implementing them. Present multiple review items together only when the user explicitly requests a batch. Use the format below, and write the analysis in plain language about behavior and design, without code snippets.
   - Every review item must show both the reviewer's verbatim comment and its exact target in the same response, including when revisiting an item. A link, filename, summary, or related implementation is not a substitute for the target.
   - For an inline code comment, include a fenced code block containing the exact targeted lines, with the file path, line numbers, and revision link above it. Use the comment's diff hunk and original revision for outdated comments; label any current-head comparison separately.
   - For a comment about prose, including a PR description, quote the exact passage being criticized before the reviewer's comment. Retrieve that passage rather than reconstructing it from the reviewer's paraphrase.
   - If the comment has no explicit target, say so. If the target cannot be retrieved, report that limitation; never substitute related code or invent a target.
   - Keep prose quotes at a single blockquote level; never nest quotes. The restriction on code snippets applies to analysis, not to the required target code block.
   - Start every review item, including reprints, with `**F<ID> · <short title> (N more to go)**`. Count the review comments still to be presented after this item, excluding the current item, already presented comments, author explanatory notes, and queued implementation work. Show `(0 more to go)` on the last item. Keep IDs stable and recalculate the count when the queue changes; an approved overlapping fix does not replace presenting a reviewer's comment.
   - Below the heading, identify the exact target with its file or prose source and link. For code, link to the reviewed revision (`https://github.com/{owner}/{repo}/blob/{revision}/{path}#L{line}` or `#L{start}-L{end}`).
   - Follow with the bold author handle and a link to the comment's `html_url`, then the comment text verbatim on the next lines inside the same blockquote.
   - Below the blockquote, give a bold **TL;DR** with the verdict (valid, partially valid, or not applicable) and one ID-labelled bullet per supporting point, then a bold **Recommended action** with one ID-labelled bullet per action, then a `---` separator.

   ```markdown
   **F1 · {short title} ({N} more to go)**

   > **[`{path}`]({file-url})**: {what the file or code is}
   >
   > **Exact target**
   > {verbatim targeted prose; for code, show the targeted lines in a fenced code block instead}
   >
   > **@{author}** · [comment]({comment-html-url})
   > {comment text}

   **TL;DR:** {verdict}
   - **F1.1** {point with evidence}

   **Recommended action:**
   - **F1A1** {what to do or reply}

   ---
   ```

   Do not reply to a comment that needs code changes, design work, or another action; reply once that action is taken, describing what was done. When a comment needs no action beyond answering it, write the proposed reply right away under that action as a reply card that mirrors the comment card: a single-level blockquote starting with the bold handle of the account that will post it (from `gh api user --jq .login`) and `· reply`, then the reply text, following the Writing Rules in SKILL.md.

   ```markdown
   - **F1A1** Reply; no code change needed:

     > **@{login}** · reply
     > {reply text}
     >
   ```

   End the reply card with an empty `>` line so terminal Markdown renderers close the blockquote correctly.

   After the reviewer comments, present issues reviewers did not raise one at a time, using `**D1**`-style IDs.
6. Settle every item's disposition for this PR before starting any fixes or posting replies. Keep a per-PR decision record with stable IDs, chosen actions, and unanswered questions.
   - An approved action ID queues that action; it does not start implementation while other decisions remain open. `Next` moves the discussion forward without approving the skipped item. Retain earlier approvals and revisit skipped or unanswered items individually before starting fixes.
   - Treat an item as settled when existing user direction establishes its fix, reply, no-change decision, or explicit deferral. Merely presenting an item does not settle it. Record the reason and remaining blocker for a deferral; never infer product approval or silently defer an unanswered question.
   - While decisions remain open, continue investigation needed to answer them, but keep fixes, commits, pushes, replies, and thread resolution queued unless the user explicitly changes this sequence.
   - Once every item has a disposition, state the agreed queue and execute its authorized work. Do not request another blanket confirmation or re-ask approvals already given. Complete and verify fixes before posting their approved replies; authorization to fix alone does not authorize a reply or thread resolution.
7. For each approved reply action, such as `F2A1`, post after the decision phase and any required fix verification, without asking again. Use the proposed text or the user's corrections. Write the body to `.tmp/pr-<number>/reply-<ID>.md` and pass it with `-F body=@<file>`.
   - Inline review comment: `POST repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies`. Reply to the thread's top-level comment; GitHub rejects replies to replies.
   - Conversation comment: `POST repos/{owner}/{repo}/issues/{number}/comments`, quoting the comment being answered.
8. After posting a reply, remove the account owner's `eyes` reaction from the comment it answers. List its reactions, then delete the owner's `eyes` reaction with `DELETE repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}` (or `issues/comments/...` for conversation comments). Expect `204`, and report the posted reply's link. This does not resolve the review thread.
9. When the user asks to resolve a reviewer's comments, resolve each of that reviewer's review threads with the GraphQL `resolveReviewThread` mutation. List the threads first with `pullRequest.reviewThreads` (`id`, `isResolved`, and the first comment's author), resolve only threads the named reviewer started, and leave the account owner's own explanatory comments open for reviewers.
10. After publishing the approved comments and replies, give the user the PR link and end the turn for their inspection. Wait for separate, explicit approval to post the closing message and request re-review; approval to fix or publish comments does not authorize that handoff. Record comment publication, closing-message approval, and re-review-request approval separately in the per-PR decision record. The user may approve the latter two together, such as saying "we good" after reviewing the PR when both actions are the agreed next step. Then perform the [re-review handoff](#re-review-handoff) once for this PR; do not notify downstream PRs that only inherited fixes.

## Re-review handoff

1. Refresh the PR head, checks, and all three feedback sources before announcing readiness. Reconcile new comments with the decision record. Require all agreed fixes to be pushed and verified and all approved replies and explanatory comments to be posted and read back. An unanswered item, an unpublished reply, or a blocking deferral keeps the round incomplete; report what remains instead of claiming all comments are addressed. State the actual validation status; do not call pending or failed CI passed.
2. Collect and deduplicate the GitHub logins of the reviewers whose feedback was answered in this round, including PR-level reviews and conversation comments. Mention those comment authors, not automatically the PR author or everyone who ever reviewed it. Exclude the posting account and bots unless explicitly requested. Confirm each recipient's feedback in the round is accounted for by fixes or agreed, published explanations. If no recipients remain, skip the notice and review requests and record why.
3. With explicit approval for the closing message, post one concise PR conversation comment mentioning all those reviewers, stating that their feedback has been addressed and the PR is ready for re-review. Include the pushed head or relevant commits and a short validation result; link individual replies only when useful. Follow the first-person Writing Rules in SKILL.md. Honor applicable comment-preview requirements and reuse approval already given for this specific step. Do not bundle handoff approval into an earlier approval to publish replies or infer it from silence, elapsed time, or passing checks.

   Example after verifying every claim:

   > cc @reviewer-one @reviewer-two — I've addressed all your comments from this review round and posted the replies above. The fixes are pushed in `{head-sha}`; the relevant tests and required checks pass. Ready for re-review.

   Check the conversation for an existing notice covering this head and feedback round before posting. Save the body to `.tmp/pr-<number>/re-review.md` and use `gh pr comment <number> --repo <owner>/<repo> --body-file <file>`. Read back the published comment and record its URL in the decision record. A partial failure or resumed session must not produce a duplicate notice.
4. With explicit approval covering review requests, request re-review from the same eligible reviewers after publishing the notice. Approval of the notice alone does not authorize this step unless the user approved both together. GitHub supports [re-requesting a review](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/requesting-a-pull-request-review) through the Reviewers sidebar. For automation, use `gh pr edit <number> --repo <owner>/<repo> --add-reviewer <login>` for each recipient, or the [review-request API](https://docs.github.com/en/rest/pulls/review-requests#request-reviewers-for-a-pull-request) with a `reviewers` array. Read `GET repos/{owner}/{repo}/pulls/{number}/requested_reviewers` first and skip requests already pending; preserve unrelated reviewers and never remove/re-add a request just to trigger another notification.
5. Verify the requests by reading the requested reviewers again. If a reviewer has already responded, verify that newer review instead. Record each result alongside the head and closing-comment URL. If GitHub rejects a recipient or permission is missing, keep the successfully posted notice, report the exact failed request, and leave that step pending; do not claim the request succeeded or repost the notice. End the turn with the notice link and request status, handing the PR back to its reviewers. Re-review does not imply approval, thread resolution, or authorization to merge.
