## Check existing configuration

Load the local configuration described in the skill before asking for account details. Follow its `account_guidance` path and repository guidance for missing information. The config contains account metadata and credential locations, never password or private-key contents. After successful setup, save verified reusable metadata there with owner-only access so future invocations can recover it without this conversation. Keep these machine-specific values outside public repositories.

Read only relevant credential names or metadata; avoid dumping secret files or keychains. A certificate file without its private key is insufficient for signing. Do not revoke or rotate certificates as routine notarization setup.

The notarytool profile is an arbitrary Keychain label. Credentials belong to the developer account/team and can serve multiple apps. An Apple Account app-specific password is for the client accessing Apple's service; it is not tied to the bundle being notarized.

Validate a candidate profile directly with `notarytool history`. An ordinary login-keychain dump does not reliably establish its absence: notarytool uses the data protection keychain by default. Follow [Apple's credential guidance](https://developer.apple.com/documentation/technotes/tn3147-migrating-to-the-latest-notarization-tool).

## Configure a reusable profile

1. Require approved Apple Developer Program membership, a valid Developer ID Application identity and private key, and installed `notarytool` and `stapler`. Install/select current Xcode or Command Line Tools if the required tools are missing; do not change the global developer directory when a scoped `DEVELOPER_DIR` suffices.
2. Reuse the intended account/team from verified configuration. Obtain missing account information from the user rather than guessing. Use `AppleNotarization` as the profile name unless another is already configured or requested.
3. With Apple ID authentication, generate an [app-specific password](https://support.apple.com/en-us/102654) at Apple Account → Sign-In and Security → App-Specific Passwords. Save it through the secure prompt:

   ```sh
   xcrun notarytool store-credentials "$NOTARY_PROFILE" --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID"
   ```

   Let the command validate credentials before saving. Do not use `--no-validate`. First check the configured `password_env` in the environment and then its selected assignment in `password_source`, with tracing disabled. Load only that assignment instead of sourcing an unrelated secrets file in full. For an app-specific password variable such as `APPLE_NOTARIZATION_KEY`, pass it through `--password "$APPLE_NOTARIZATION_KEY"`; do not print it or insert its literal value into command text. Confirm the credential type from configuration and guidance: a variable named “key” is not proof that it contains an App Store Connect API key. Have the user enter a password locally only when no usable configured credential remains; never request its value in chat.
4. For an existing App Store Connect API key, use the installed tool's supported options:

   ```sh
   xcrun notarytool store-credentials "$NOTARY_PROFILE" --key "$API_KEY_PATH" --key-id "$API_KEY_ID" --issuer "$API_ISSUER_ID"
   ```

   The issuer is required for team API keys. Omit `--issuer` for individual API keys when supported by the installed tool. Keep the private key outside the repository; do not convert authentication methods or create new keys unnecessarily.
5. Run `xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" --output-format json`. Confirm successful authentication and that the configured team matches the intended signing team before submission. A successful empty history is valid.

If credentials fail, retain the signed staging artifact and report the actual authentication error without secret values. If membership is not active, required agreements are pending, the signing private key is absent, or the Keychain is inaccessible, identify that prerequisite and the precise local action needed. Account approval alone does not install a signing identity or configure notarytool credentials.
