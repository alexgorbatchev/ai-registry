---
created_on: 2026-05-04 22:47
last_modified: 2026-05-04 23:01
status: current
---

# FUSE Live Registry Projection

## Objective and non-goals

This design defines a live projection layer for AI harness assets. The layer exposes global canonical registry assets and repo-specific canonical assets through harness-specific virtual filesystems while preserving deterministic writeback ownership.

The v1 implementation must provide these outcomes:

- Harnesses read current local-looking files from a project-scoped virtual config root.
- Existing global canonical skills and commands write back to `ai-registry` and become visible to every project view on the next uncached read.
- Existing repo-specific skills and commands write back only to that repo's `.ai-registry/` tree.
- New skills and commands created from a project harness view are repo-specific by default.
- Duplicate visible asset names across global and repo-specific scopes are a hard error by default.
- Repos use one repo-local AI folder, `.ai-registry/`, instead of multiple harness-specific dot folders.

Out of scope for v1:

- Implementing the FUSE daemon.
- Supporting Windows.
- Committing generated harness projection files into consuming repos.
- Allowing silent repo-local overrides of global asset names.
- Writeback for generated agents or generated harness configuration files.
- Solving cross-machine propagation without a shared filesystem, registry Git sync, or another external sync mechanism.
- Requiring FUSE or macFUSE for normal CI validation.

## Current codebase baseline

Verified current behavior in this repository:

- `skills/` contains global canonical skill directories with `SKILL.md` files.
- `commands/` contains global canonical command Markdown files.
- `profiles/` contains profile manifests and optional profile-local assets.
- `harnesses/opencode/scripts/build.ts` generates `.output/opencode/commands`, `.output/opencode/skills`, and `.output/opencode/agents` from selected registry assets.
- `bun run bootstrap` links `.output/opencode` into `${XDG_CONFIG_HOME:-~/.config}/opencode` through the OpenCode harness plugin bootstrap target.
- OpenCode documentation in `harnesses/opencode/docs/skills.mdx` says OpenCode discovers project skills at `.opencode/skills/<name>/SKILL.md` and global skills at `~/.config/opencode/skills/<name>/SKILL.md`.
- OpenCode documentation in `harnesses/opencode/docs/commands.mdx` says OpenCode discovers project commands at `.opencode/commands/` and global commands at `~/.config/opencode/commands/`.
- OpenCode documentation in `harnesses/opencode/docs/agents.mdx` says OpenCode discovers Markdown agents at `.opencode/agents/` and `~/.config/opencode/agents/`.
- OpenCode documentation in `harnesses/opencode/docs/config.mdx` says `OPENCODE_CONFIG_DIR` can point OpenCode at a custom config directory.
- `packages/opencode-session-analysis/src/syncProjectSkills.ts` currently copies selected skills into `.opencode/skills/` and writes `.opencode/skills-manifest.json`; this is snapshot sync, not live projection.

## Non-negotiable constraints

- The canonical global source of truth remains this repository's source tree, not `.output/`.
- The repo-specific source of truth is `.ai-registry/` inside the consuming repo.
- A consuming repo must not need `.opencode/`, `.claude/`, `.agents/`, `.pi/`, or other harness-specific source folders for v1 live projection.
- A visible asset name collision between global and repo-specific scopes must fail projection creation unless the project manifest explicitly enables a named override in a future schema. v1 must not implement override opt-in.
- Global assets and repo-specific assets must use the same canonical asset schema before harness adaptation.
- Harness-facing files are projections. The daemon must derive their content from canonical assets on read and must convert accepted writes back to canonical assets on flush or rename completion.
- Generated profile agents and generated harness config files must be read-only in v1.
- macOS support requires macFUSE or an equivalent user-space filesystem provider. Linux support requires FUSE.
- A daemon crash must not corrupt canonical assets. Writes must use validate-then-atomic-replace semantics.
- CI must validate projection behavior through deterministic non-FUSE commands by default.
- FUSE and macFUSE CI jobs must be platform-specific integration jobs, not required for every consuming repo validation run.

## Exact architecture choice

Implement a user-space projection daemon with harness adapters and FUSE-backed project views.

The daemon owns these layers:

1. **Global canonical store**: `{{repo_root}}/skills/` and `{{repo_root}}/commands/`.
2. **Repo canonical store**: `<project-root>/.ai-registry/skills/` and `<project-root>/.ai-registry/commands/`.
3. **Asset index**: a per-project merged index with explicit owner metadata for every visible asset.
4. **Harness adapter registry**: adapters that convert canonical assets to and from harness-specific files.
5. **FUSE mount manager**: mounts one project view under a cache/runtime path outside the repo.
6. **Harness launch wrappers**: launch harnesses with environment variables pointing at the project view.

Reject these alternatives for v1:

- Symlink-only views: symlinks cannot transform writes between harness-specific and canonical formats.
- Copy-sync as the primary mechanism: copies create stale snapshots and require manual refresh.
- Git submodules: submodules store commit pointers instead of normal checked-in source files.
- Full repo-local harness dot folders: multiple harness folders litter consuming repos and duplicate canonical content.
- Silent overrides: ambiguous same-name global and repo assets make writeback unsafe.

## Data model / schema

No database is required in v1. The daemon uses filesystem state plus optional runtime caches.

### Repo manifest

Each consuming repo may define this file:

```text
<project-root>/.ai-registry/manifest.yaml
```

Use this exact v1 shape:

```ts
interface ProjectAiRegistryManifestV1 {
  version: 1;
  profile: string;
  global?: {
    skills?: string[];
    commands?: string[];
  };
  repo?: {
    skills?: string[];
    commands?: string[];
  };
}
```

Selection semantics:

- Missing `global.skills` means no global skills are projected, except skills selected by `profile` when profile integration is implemented.
- Missing `global.commands` means no global commands are projected, except commands selected by `profile` when profile integration is implemented.
- Missing `repo.skills` means all repo-specific skills under `.ai-registry/skills/` are projected.
- Missing `repo.commands` means all repo-specific commands under `.ai-registry/commands/` are projected.
- `*` means every asset in that scope and kind.
- Globs use the same matching semantics as existing registry profile selection once implemented against the current build helpers.

## Types and contracts

### Asset owner

```ts
type AssetScope = "global" | "repo";

interface AssetOwner {
  scope: AssetScope;
  canonicalDirectoryPath: string;
  canonicalFilePath: string;
  projectRootPath?: string;
}
```

### Asset kind

```ts
type AssetKind = "skill" | "command";
```

### Canonical asset

```ts
interface CanonicalAsset {
  kind: AssetKind;
  name: string;
  owner: AssetOwner;
  canonicalFilePath: string;
  content: string;
  checksum: string;
}
```

### Project asset index

```ts
interface ProjectAssetIndex {
  projectRootPath: string;
  profileName: string;
  assetsByHarnessPath: Record<string, CanonicalAsset>;
  assetsByCanonicalKey: Record<string, CanonicalAsset>;
  diagnostics: ProjectionDiagnostic[];
}

type ProjectionDiagnostic =
  | {
      type: "duplicate-visible-name";
      kind: AssetKind;
      name: string;
      globalPath: string;
      repoPath: string;
    }
  | {
      type: "invalid-canonical-asset";
      kind: AssetKind;
      name: string;
      path: string;
      message: string;
    };
```

Projection creation must fail when `diagnostics` contains any `duplicate-visible-name` entry.

### Harness adapter

```ts
interface HarnessAdapter {
  harnessName: string;
  toHarnessPath(asset: CanonicalAsset): string;
  toHarnessContent(asset: CanonicalAsset): string;
  fromHarnessContent(args: {
    harnessPath: string;
    previousAsset?: CanonicalAsset;
    content: string;
    defaultOwner: AssetOwner;
  }): CanonicalWrite;
  validateHarnessWrite(args: {
    harnessPath: string;
    previousAsset?: CanonicalAsset;
    content: string;
  }): ValidationResult;
}

interface CanonicalWrite {
  kind: AssetKind;
  name: string;
  owner: AssetOwner;
  canonicalFilePath: string;
  content: string;
}

type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };
```

## Exact file plan

This design records the planned implementation surface. Do not implement these files as part of this documentation change.

### Add

- `packages/live-registry-projection/package.json`
- `packages/live-registry-projection/src/cli.ts`
- `packages/live-registry-projection/src/projectManifest.ts`
- `packages/live-registry-projection/src/canonicalAssets.ts`
- `packages/live-registry-projection/src/projectAssetIndex.ts`
- `packages/live-registry-projection/src/harnessAdapters/types.ts`
- `packages/live-registry-projection/src/harnessAdapters/opencode.ts`
- `packages/live-registry-projection/src/fuse/mountProjectView.ts`
- `packages/live-registry-projection/src/materialize/materializeProjectView.ts`
- `packages/live-registry-projection/src/ci/validateProjectView.ts`
- `packages/live-registry-projection/src/writeback/atomicCanonicalWrite.ts`
- `packages/live-registry-projection/src/writeback/routeHarnessWrite.ts`
- `packages/live-registry-projection/src/__tests__/projectAssetIndex.test.ts`
- `packages/live-registry-projection/src/__tests__/routeHarnessWrite.test.ts`
- `packages/live-registry-projection/src/__tests__/opencodeAdapter.test.ts`
- `packages/live-registry-projection/src/__tests__/validateProjectView.test.ts`
- `packages/live-registry-projection/src/__tests__/materializeProjectView.test.ts`

### Modify

- `package.json`: add `packages/live-registry-projection` to workspaces when the package is implemented.
- `harnesses/opencode/scripts/build.ts`: generate an `air-opencode` wrapper only after the live projection package exists.
- `README.md`: document the live projection workflow only after implementation exists.
- `AGENTS.md`: document the live projection repository workflow only after implementation exists.

## Runtime behavior

### Project view location

The daemon must mount project views outside the consuming repo:

```text
${XDG_CACHE_HOME:-~/.cache}/ai-registry/views/<project-id>/<harness>/
```

For OpenCode v1, the wrapper must launch:

```bash
OPENCODE_CONFIG_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/ai-registry/views/<project-id>/opencode" opencode "$@"
```

### Read path

For each read request:

1. Resolve `harnessPath` against the project asset index.
2. Read the canonical backing file from the asset owner path.
3. Recompute adapter output for the harness file.
4. Return the harness-specific content.

The daemon may cache canonical reads only when it invalidates the cache on canonical file mtime or content checksum change.

### Existing asset write path

For each completed write to an existing projected skill or command:

1. Resolve the existing `CanonicalAsset` by `harnessPath`.
2. Validate the harness content with the adapter.
3. Convert harness content to canonical content with the adapter.
4. Revalidate the canonical content.
5. Atomically replace the existing `owner.canonicalFilePath`.
6. Invalidate all project view cache entries that reference the same canonical file.

### New asset write path

When a harness creates a new skill or command path that does not exist in the index:

1. Infer `kind` and `name` from the harness path.
2. Assign the owner to the repo scope.
3. Write to `<project-root>/.ai-registry/<kind-directory>/<name>/SKILL.md` for skills.
4. Write to `<project-root>/.ai-registry/commands/<name>.md` for commands.
5. Reject the write when the new name duplicates any visible global or repo asset.

### Read-only paths

The daemon must reject writes to generated agents, generated config files, and unknown harness paths with `EROFS` or the closest platform-specific read-only filesystem error.

### Non-FUSE materialization path

CI and tests must use the same manifest parsing, asset discovery, duplicate detection, adapter, and validation modules as the FUSE daemon without mounting a filesystem.

For each materialization request:

1. Build the project asset index for `projectRootPath`, `harness`, and `registryRootPath`.
2. Fail before writing output when the index contains duplicate visible names or invalid canonical assets.
3. Delete and recreate the caller-provided output directory only when it is inside the project `.tmp/` directory or an explicit CI workspace directory.
4. Write adapter-produced harness files into the output directory.
5. Write a machine-readable manifest at `<output>/.air-registry-projection.json`.
6. Mark the materialized output read-only when `readonly` is `true`.

Materialized output is disposable generated state. CI must never commit it back to a consuming repo.

## Validation rules

- Skill names must match `^[a-z0-9]+(-[a-z0-9]+)*$`.
- Skill directory names must match the `name` frontmatter field in `SKILL.md` when the harness format contains a name field.
- Command names must be lowercase kebab-case without file extension in the projected harness path.
- Duplicate visible names across global and repo-specific assets are fatal for the project view.
- A write to a global asset must only target an asset already owned by the global scope.
- A write to a repo asset must only target an asset already owned by the repo scope or a newly created asset.
- A write must not change an existing asset's owner scope.
- A write must not create a repo asset whose visible name matches a global asset.
- Generated agents and generated configs must be read-only.
- The daemon must write canonical files through a temp file in the same directory followed by atomic rename.

## Exact API surface

No HTTP API is required in v1.

The CLI surface for the future package must be:

```text
air-registry-view mount --project <path> --harness opencode
air-registry-view status --project <path>
air-registry-view doctor --project <path>
air-registry-view validate --project <path> --harness opencode --registry <path> --ci
air-registry-view materialize --project <path> --harness opencode --registry <path> --output <path> --readonly
air-opencode [opencode args...]
```

Command contracts:

```ts
interface MountCommandOptions {
  project: string;
  harness: "opencode";
}

interface StatusCommandOptions {
  project: string;
}

interface DoctorCommandOptions {
  project: string;
}

interface ValidateCommandOptions {
  project: string;
  harness: "opencode";
  registry: string;
  ci: boolean;
}

interface MaterializeCommandOptions {
  project: string;
  harness: "opencode";
  registry: string;
  output: string;
  readonly: boolean;
}
```

`status` must report duplicate visible names and invalid canonical assets before any harness launch.

`validate --ci` must exit non-zero when any of these conditions exists:

- the project manifest is missing required v1 fields;
- the manifest references a global asset that does not exist under `registry`;
- a repo-local canonical asset is invalid;
- a duplicate visible asset name exists across global and repo scopes;
- the harness adapter cannot project every selected asset;
- the projected harness file path is invalid for the selected harness.

`materialize --readonly` must fail with the same validation checks before it writes any files.

## CI contract

### Registry repository CI

The `ai-registry` repository CI must run these commands on every pull request and main branch update:

```text
bun install
bun run typecheck
bun run build
bun run bootstrap:smoke
bun test packages/live-registry-projection
```

The package-specific test command is required only after `packages/live-registry-projection` exists.

The registry repository CI must verify that `bun run build` leaves no uncommitted generated-output drift in `.output/manifest.json` or generated harness files.

### Consuming repository CI

Each consuming repo that uses `.ai-registry/` must run projection validation without FUSE:

```text
air-registry-view validate --project "$PWD" --harness opencode --registry "$AI_REGISTRY_ROOT" --ci
air-registry-view materialize --project "$PWD" --harness opencode --registry "$AI_REGISTRY_ROOT" --output "$PWD/.tmp/air-opencode" --readonly
```

Consuming repo CI must not require `.opencode/`, `.claude/`, `.agents/`, `.pi/`, or other harness-specific source folders to exist in the repository.

### Registry reference policy

Consuming repo CI must choose one of these registry reference modes explicitly in its workflow configuration:

```ts
type RegistryReferenceMode =
  | {
      mode: "pinned";
      registryGitRef: string;
    }
  | {
      mode: "latest-main";
      registryRemote: string;
    };
```

`pinned` mode is the default for pull request CI because it keeps consuming repo builds reproducible. A consuming repo updates `registryGitRef` through a normal code review when it opts into new global registry content.

`latest-main` mode is allowed only for scheduled compatibility jobs and mainline propagation checks. A failure in `latest-main` mode must open or update a propagation issue or PR instead of blocking unrelated consuming repo pull requests.

### Propagation workflow

When a global skill or command changes in `ai-registry`, propagation across repos happens through one of these mechanisms:

1. Same-machine local development sees the change immediately through the live projection view.
2. CI in `latest-main` mode detects compatibility failures against current global content.
3. A propagation bot opens PRs in consuming repos that update the pinned `registryGitRef` and run `air-registry-view validate` plus `materialize`.

Global registry changes must not silently break unrelated consuming repo pull requests that run in `pinned` mode.

### FUSE integration CI

FUSE integration CI must be separate from normal validation CI.

Linux FUSE CI must run only in an environment with `/dev/fuse` available and permissions configured for the test runner. macOS FUSE CI must run only in an environment with macFUSE or an equivalent provider installed.

FUSE integration CI must cover the same read, create, write, flush, fsync, rename, unlink rejection, and read-only behavior listed in the testing plan. Normal consuming repo CI must rely on non-FUSE `validate` and `materialize` commands.

## Implementation order

1. Implement manifest parsing and validation.
2. Implement canonical asset discovery for global and repo scopes.
3. Implement duplicate visible name detection as a hard error.
4. Implement the OpenCode adapter in pure TypeScript without FUSE.
5. Implement writeback routing and atomic canonical writes.
6. Implement non-FUSE `validate` and `materialize` commands for CI.
7. Add a non-FUSE materialization test harness to prove read/write transforms.
8. Implement Linux FUSE mount support.
9. Implement macOS macFUSE mount support.
10. Generate `air-opencode` wrapper after the package is stable.
11. Document the public workflow in `README.md` and update `AGENTS.md`.

## Testing plan

- Unit-test manifest parsing with missing optional sections, explicit selections, and `*` selections.
- Unit-test asset discovery for global-only, repo-only, and mixed project stores.
- Unit-test duplicate visible name detection as a hard error.
- Unit-test writeback routing:
  - existing global skill writes to `{{repo_root}}/skills/<name>/SKILL.md`;
  - existing repo skill writes to `<project-root>/.ai-registry/skills/<name>/SKILL.md`;
  - new skill writes to repo scope;
  - new skill matching a global name is rejected.
- Unit-test OpenCode adapter round trips for skills and commands.
- Integration-test materialized projection before FUSE integration.
- Integration-test `validate --ci` failure cases for invalid manifests, missing global references, invalid repo-local assets, duplicate visible names, and adapter projection failures.
- Integration-test `materialize --readonly` output manifest creation and read-only output permissions without FUSE.
- Integration-test FUSE read, create, write, flush, fsync, rename, unlink rejection, and read-only error behavior on Linux.
- Integration-test macFUSE behavior on macOS before declaring macOS support complete.

## Out-of-scope / rejection list

Reject implementations that do any of the following:

- Store canonical edits in `.output/`.
- Create multiple harness-specific source folders inside consuming repos.
- Allow duplicate visible asset names without a hard error.
- Route new project-created assets to the global registry by default.
- Silently convert an existing repo asset into a global asset.
- Make generated agents writable before exact profile round-trip semantics exist.
- Depend on checked-in symlinks for portability.
- Treat copy-sync as the live propagation mechanism.
- Require FUSE or macFUSE for normal consuming repo CI validation.
- Run consuming repo pull request CI against moving `ai-registry` main without an explicit latest-main compatibility job policy.

## Definition of done

This design is implemented when:

- `air-opencode` can launch OpenCode against a project-scoped virtual config root outside the repo.
- OpenCode can read global and repo-specific skills from one projected `skills/` tree.
- Editing an existing global skill through the projected OpenCode path updates the global canonical skill file.
- Editing an existing repo-specific skill through the projected OpenCode path updates the repo `.ai-registry` skill file.
- Creating a new skill through the projected OpenCode path creates a repo-specific skill.
- A same-name global and repo-specific skill prevents the project view from mounting.
- Generated agents and generated configs are read-only.
- `air-registry-view validate --ci` and `materialize --readonly` validate consuming repos without FUSE.
- Consuming repo CI has an explicit pinned or latest-main registry reference policy.
- Linux and macOS behavior is validated with platform-specific integration tests.
- `README.md`, `AGENTS.md`, and `skills/ai-registry-integration/SKILL.md` document the final implemented workflow.

## Ambiguity sweep

- Duplicate visible names are a hard error in v1.
- Writeback ownership is determined by existing asset owner metadata.
- New assets created from a project view are repo-specific.
- Global propagation happens by editing the global canonical file, not by copying generated projections.
- Repo-specific skills coexist with global skills only when names are unique.
- Generated agents and generated harness config files are read-only in v1.
- Normal CI uses non-FUSE validation and materialization; FUSE CI is a separate platform integration layer.
- Pull request CI uses pinned registry refs by default; latest-main checks are scheduled compatibility or propagation jobs.
