---
name: apple-notarize-app
description: Sign, notarize, staple, and verify a macOS app for distribution outside the Mac App Store.
author: alexgorbatchev
metadata:
  created_on: 2026-10-26 14:46
  last_modified: 2026-10-26 14:55
  status: current
---

## Identify the artifact and credentials

Before asking setup questions, read `${APPLE_NOTARIZE_CONFIG:-$HOME/.config/apple-notarize-app/config.json}` when present. Use its `apple_id`, `team_id`, `notary_profile`, `signing_identity_sha1`, `password_env`, `password_source`, and `account_guidance` as machine defaults. Expand `~` in configured paths. Explicit invocation settings and verified project-specific configuration take precedence. Resolve command variables from these values; do not ask the user to repeat usable saved information. Read the configured account guidance when signing or credential setup needs repair.

1. Resolve the target app, version, architectures, intended output, and any existing release from the request and repository guidance. Distinguish a local development build, an installed app, and a published download; checking one does not establish the status of the others. If the target remains ambiguous, ask for the app path or project while continuing independent inspection.
2. Inspect existing build and signing workflows before creating another. Use the intended release artifact; do not silently substitute a debug build, rebuild an already released version from different source, bump its version, or move a release tag.
3. Check `xcrun --find notarytool`, `xcrun --find stapler`, and `security find-identity -v -p codesigning`. Select the configured valid **Developer ID Application** identity with its private key for the intended team. If its fingerprint has changed, find the valid replacement for that same team rather than assuming membership is missing. Resolve remaining identity or team ambiguity before signing.
4. Reuse the configured notarytool Keychain profile; try `AppleNotarization` when no other profile is specified. Validate it with `xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" --output-format json`. A missing profile does not imply a missing developer membership or signing certificate. Read [references/setup.md](references/setup.md) when credentials or signing prerequisites need configuration.

Keep credential values out of chat, logs, repository files, and command tracing. Read current [Apple notarization requirements](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) and installed command help when platform behavior or flags are uncertain.

## Prepare and sign

1. Stage a copy in an ignored working directory using `ditto`; resolve an app symlink to its real bundle before staging. Preserve the original artifact. Record the app's bundle identifier, version, architectures, current signature, and entitlements.
2. Prefer the project's release/archive export workflow when it already produces correct signatures and entitlements. For manual signing, inspect nested frameworks, helpers, extensions, plug-ins, and executable code. Sign nested code from the inside out, with the outer app last. Do not use `codesign --deep` for signing or apply the main app's entitlements indiscriminately to nested targets.
3. Use Developer ID signing, a secure timestamp, and hardened runtime for executable targets. Retain required production entitlements from verified project configuration, exclude `com.apple.security.get-task-allow=true`, and do not add broad runtime exceptions merely to make notarization pass. For a simple app requiring no extra entitlements:

   ```sh
   codesign --force --sign "$SIGNING_IDENTITY" --options runtime --timestamp "$STAGED_APP"
   ```

4. Require `codesign --verify --deep --strict --verbose=2 "$STAGED_APP"` to succeed. Inspect `codesign -d --verbose=4 "$STAGED_APP"` for the intended Developer ID authority, TeamIdentifier, runtime flag, and secure timestamp. Inspect entitlements on relevant executable targets. Reuse an existing signature when it already meets these requirements. If signing changes the code directory hash, any previous ticket no longer covers that code.

## Submit and resolve the result

Create a ZIP around the signed app, retaining its parent bundle:

```sh
ditto -c -k --sequesterRsrc --keepParent "$STAGED_APP" "$SUBMISSION_ZIP"
xcrun notarytool submit "$SUBMISSION_ZIP" --keychain-profile "$NOTARY_PROFILE" --output-format json
```

Persist the returned submission ID and archive SHA-256 in the ignored working directory. Wait on that submission, keeping progress visible:

```sh
xcrun notarytool wait "$SUBMISSION_ID" --keychain-profile "$NOTARY_PROFILE" --timeout 60s --output-format json
xcrun notarytool info "$SUBMISSION_ID" --keychain-profile "$NOTARY_PROFILE" --output-format json
xcrun notarytool log "$SUBMISSION_ID" --keychain-profile "$NOTARY_PROFILE" "$NOTARY_LOG"
```

- A wait timeout leaves Apple's submission running. Continue waiting on the same ID; do not upload duplicates because a wait expired. If submission output is lost, reconcile recent history and the artifact before retrying an upload.
- Require an explicit `Accepted` status. Fetch and inspect the log even after acceptance; distinguish warnings from blocking errors. For rejection, fix the reported cause, repeat affected build/signing checks, then submit the changed artifact.
- Diagnose credential, network, and ticket propagation failures before declaring a blocker. Keep submission IDs and prepared artifacts when user action is required; report the exact missing prerequisite and continue independent authorized work. Do not disable Gatekeeper or remove quarantine as a substitute for verification.

## Staple, package, and verify

After acceptance, staple the ticket to the app, not its ZIP:

```sh
xcrun stapler staple "$STAGED_APP"
xcrun stapler validate "$STAGED_APP"
codesign --verify --deep --strict --verbose=2 "$STAGED_APP"
spctl --assess --type execute --verbose=4 "$STAGED_APP"
```

Require successful ticket validation and Gatekeeper acceptance as `Notarized Developer ID`. If the selected OS uses another assessment interface, verify its documented equivalent. Signing validity, notarization acceptance, stapling, and Gatekeeper assessment are separate checks.

1. Create the final distribution ZIP **after stapling**, using `ditto -c -k --sequesterRsrc --keepParent`. Do not distribute the pre-stapling submission ZIP. Never modify or re-sign executable contents after notarization without repeating submission and stapling.
2. Extract the final ZIP into a fresh directory. Repeat ticket validation, strict signature verification, and Gatekeeper assessment on that extracted app. Perform the project's relevant release smoke check, especially when hardened runtime was newly enabled; report any untested runtime behavior.
3. Generate SHA-256 checksums against the final archive, using its basename in the checksum file. Preserve established asset filenames; do not add signing-status suffixes or display labels unless requested. Publish only within the session's authorized distribution scope. Inspect existing release assets first; replace or delete them only when authorized, and do not leave obsolete assets or conflicting signing claims after an authorized replacement. When renaming an archive, regenerate its checksum entry and update download references.
4. After an authorized upload, verify remote asset metadata and the downloaded artifact's checksum. Report the verified artifact path or download link, submission status, stapling and Gatekeeper results, and any remaining blocker. Never claim another app or release is notarized based on this submission.

Consult [Apple's custom workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow) for DMG, PKG, and nested installer distribution; ZIPs cannot carry stapled tickets themselves. Preserve the requested distribution format and apply its format-specific signing and stapling requirements.
