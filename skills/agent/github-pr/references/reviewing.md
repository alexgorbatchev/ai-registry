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
5. Evaluate every open comment first, then present them one at a time in the order they should be resolved: comments that need only a reply come first, then comments that need code changes or a decision. Show the next comment once the current one is resolved or the user moves on, and present issues reviewers did not raise after the last comment. Use the format below, and write the analysis in plain language about behavior and design, without code snippets.
   - Quote only the thing in question and the comment, in a single blockquote level; never nest quotes.
   - Start the blockquote with the bold comment ID and the bold thing in question, linked to the file on the PR head branch (`https://github.com/{owner}/{repo}/blob/{head-branch}/{path}`, plus `#L{line}` or `#L{start}-L{end}` for line comments), followed by a one-line description of what it is.
   - Follow with the bold author handle and a link to the comment's `html_url`, then the comment text verbatim on the next lines inside the same blockquote.
   - Below the blockquote, give a bold **TL;DR** with the verdict (valid, partially valid, or not applicable) and one ID-labelled bullet per supporting point, then a bold **Recommended action** with one ID-labelled bullet per action, then a `---` separator.

   ```markdown
   > **F1** · **[`{path}`]({file-url})**: {what the file or code is}
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
6. Wait for the user's direction before replying, resolving threads, or changing code. When the user approves an action that needs code changes or other work, queue it and move on to the next comment; start queued work only after every comment and every issue reviewers did not raise has been reviewed, then confirm the full queue before starting.
7. When the user's message names a reply action ID such as `F2A1`, post that reply without asking again: use the proposed text, or the user's corrections when given. Write the body to `.tmp/pr-<number>/reply-<ID>.md` and pass it with `-F body=@<file>`.
   - Inline review comment: `POST repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies`. Reply to the thread's top-level comment; GitHub rejects replies to replies.
   - Conversation comment: `POST repos/{owner}/{repo}/issues/{number}/comments`, quoting the comment being answered.
8. A posted reply closes the comment it answers: remove the account owner's `eyes` reaction from that comment. List its reactions, then delete the owner's `eyes` reaction with `DELETE repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}` (or `issues/comments/...` for conversation comments). Expect `204`, and report the posted reply's link.
