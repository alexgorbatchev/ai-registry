# Release policy

Use the repository’s release pipeline when available; inspect its configuration before manually creating a competing release or uploading artifacts.

## Release notes

Write `## Summary` with preferably 2–5 concise bullets about user-visible changes or operational impact verified in the shipped commit range. Exclude routine version bumps and housekeeping; say directly when a release contains only documentation or infrastructure changes. Omit installation instructions and commit lists/changelogs unless requested. Generated notes are draft material, not the final text; apply these preferences to notes published by automation too.

## Publication safeguards

- Use existing authorization for release publication and tag creation; PR authorization alone does not authorize a release. Create a missing tag only at an unambiguous authorized commit, and verify its remote target before publishing. Never silently tag the default branch or replace an existing tag. For manual GitHub release creation from an existing tag, use `--verify-tag`.
- Replace an existing asset only with explicit authorization covering that asset, its replacement, and deletion risk (`gh release upload --clobber` deletes before uploading). Reuse prior approval; when details or authorization are missing, prepare the work and suspend only the dependent publication.
- Verify the published repository, tag, title, notes, draft/prerelease/latest state, and expected assets; report the release URL.
