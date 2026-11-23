# Release policy

Use the repository’s release pipeline when available; inspect its configuration before manually creating a competing release or uploading artifacts.

## Release notes

Write `## Summary` with preferably 2–5 concise bullets about user-visible changes or operational impact verified in the shipped commit range. Exclude routine version bumps and housekeeping; say directly when a release contains only documentation or infrastructure changes. Omit installation instructions and commit lists/changelogs unless requested. Generated notes are draft material, not the final text; apply these preferences to notes published by automation too.

## Publication safeguards

- Authorization to make a change that reaches its consumers only through a release, such as a fix to a published library that another project needs, also authorizes releasing it. After the change is integrated and the release pipeline's required checks pass, bump the version, create the tag and publish through the repository's release pipeline without asking again. Do not release for review-only requests, work that stops at an open PR, or explicit limits such as "do not release"; other releases need existing authorization. Create a missing tag only at an unambiguous authorized commit, and verify its remote target before publishing. Never silently tag the default branch or replace an existing tag. For manual GitHub release creation from an existing tag, use `--verify-tag`.
- Replace an existing asset only with explicit authorization covering that asset, its replacement, and deletion risk (`gh release upload --clobber` deletes before uploading). Reuse prior approval; when details or authorization are missing, prepare the work and suspend only the dependent publication.
- Verify the published repository, tag, title, notes, draft/prerelease/latest state, and expected assets; report the release URL.
