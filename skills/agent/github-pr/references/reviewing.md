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
5. Present the complete review for this PR together: every open comment, proposed action or reply, and issue reviewers did not raise. Group related items and collect outstanding decisions in one batch; use one-item-at-a-time presentation only when the user explicitly requests it. Keep decision-making separate from implementation. Use the format below, and write the analysis in plain language about behavior and design, without code snippets.
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

   Close with `**Issues no reviewer raised**` and one `- **D1** …` bullet per issue.
6. Settle every item's disposition for this PR before starting any fixes or posting replies. Keep a per-PR decision record with stable IDs, chosen actions, and unanswered questions.
   - An approved action ID queues that action; it does not start implementation while other decisions remain open. `Next` moves the discussion forward without approving the skipped item. Retain earlier approvals and collect all remaining questions together.
   - Treat an item as settled when existing user direction establishes its fix, reply, no-change decision, or explicit deferral. Merely presenting an item does not settle it. Record the reason and remaining blocker for a deferral; never infer product approval or silently defer an unanswered question.
   - While decisions remain open, continue investigation needed to answer them, but keep fixes, commits, pushes, replies, and thread resolution queued unless the user explicitly changes this sequence.
   - Once every item has a disposition, state the agreed queue and execute its authorized work. Do not request another blanket confirmation or re-ask approvals already given. Complete and verify fixes before posting their approved replies; authorization to fix alone does not authorize a reply or thread resolution.
7. For each approved reply action, such as `F2A1`, post after the decision phase and any required fix verification, without asking again. Use the proposed text or the user's corrections. Write the body to `.tmp/pr-<number>/reply-<ID>.md` and pass it with `-F body=@<file>`.
   - Inline review comment: `POST repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies`. Reply to the thread's top-level comment; GitHub rejects replies to replies.
   - Conversation comment: `POST repos/{owner}/{repo}/issues/{number}/comments`, quoting the comment being answered.
8. A posted reply closes the comment it answers: remove the account owner's `eyes` reaction from that comment. List its reactions, then delete the owner's `eyes` reaction with `DELETE repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}` (or `issues/comments/...` for conversation comments). Expect `204`, and report the posted reply's link.
9. When the user asks to resolve a reviewer's comments, resolve each of that reviewer's review threads with the GraphQL `resolveReviewThread` mutation. List the threads first with `pullRequest.reviewThreads` (`id`, `isResolved`, and the first comment's author), resolve only threads the named reviewer started, and leave the account owner's own explanatory comments open for reviewers.
