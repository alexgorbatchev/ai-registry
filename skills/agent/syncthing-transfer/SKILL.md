---
name: syncthing-transfer
description: Use when sending, fetching, or locating files between computers with Syncthing, including requests to send or fetch files to/from MacBook or dev box, or grab a file from dev box.
author: alexgorbatchev
metadata:
  created_on: 2026-10-09 15:24
  last_modified: 2026-10-09 15:24
  status: current
---

## Resolve the machines and share

1. Inspect the local dotfiles configuration under `$HOME/.dotfiles/tools/syncthing/`: read `AGENTS.md`, `buildTransferFolders.ts`, and `peers.json`. Read the relevant profile exports under `$HOME/.dotfiles/03-local/` for `SYNCTHING_PROFILE`, `SYNCTHING_DIR`, and `STHOMEDIR`. Keep actual hostnames, device IDs, and personal paths in local configuration rather than copying them into this skill.
2. Locate the installed `syncthing` executable with `command -v syncthing`. If unavailable on PATH, check the dotfiles-managed executable at `$HOME/.dotfiles/.generated/binaries/syncthing/current/syncthing`. Use the configured state directory; the managed dotfiles setup uses `$HOME/.syncthing/state`. Do not generate configuration or start a new instance to perform a transfer.
3. Read the running instance's identity and allowlisted configuration fields. With the managed state directory and executable on PATH:

   ```sh
   syncthing cli --home "$HOME/.syncthing/state" show system | jq '{myID}'
   syncthing cli --home "$HOME/.syncthing/state" config dump-json | jq '{folders: [.folders[] | {id,label,path,type,paused,devices: [.devices[].deviceID]}], devices: [.devices[] | {deviceID,name,paused}]}'
   ```

   Match `myID` to `peers.json` to identify the local profile even when the shell exports are absent. Treat live folder paths and device membership as authoritative. If they disagree with the dotfiles mapping, or the instance cannot be queried, report the discrepancy before writing files. Never print the unfiltered configuration, API keys, or private key files.
4. Resolve the requested computer against peer names and folder labels, ignoring case and spaces versus hyphens. Match “MacBook” to a uniquely named MacBook peer and “dev box” to a uniquely named dev-box peer. If several devices fit, or none does, ask which computer; do not guess from connection status or choose the first peer. If the requested computer is local, handle the file locally without staging another transfer.
5. Select the live folder containing both local and requested device IDs. Confirm its complete device membership: if other peers would receive the file, disclose that and obtain approval before copying. If several folders fit, use the managed `transfer-<laptop-profile>` folder verified against the builder; ask when that still leaves multiple candidates. Require an existing, unpaused share that supports the requested direction and an unpaused peer. Never create folders, alter sharing, unpause devices, or override folder changes as part of sending a file.

The managed dotfiles topology pairs each laptop separately with the dev box. Derive the actual profile names from the files above:

| Current machine | Other machine | Local transfer/search root | Corresponding root on other machine |
| --- | --- | --- | --- |
| Dev box | Selected laptop | `$HOME/.syncthing/<laptop-profile>/` | Other machine's `$HOME/.syncthing/<dev-box-profile>/` |
| Laptop | Dev box | `$HOME/.syncthing/<dev-box-profile>/` | Other machine's `$HOME/.syncthing/<local-laptop-profile>/` |

Use the live `path` field for local operations. Use the builder to explain the expected remote path, labeling it as expected unless remote configuration was inspected. Preserve the file's relative path within the share. Never copy directly into the parent `$HOME/.syncthing/`, which also contains daemon state. `SYNCTHING_DIR` can name that parent on the dev box; it does not select a destination. Do not relay between laptops unless the user requests that route.

## Send a file

Resolve and inspect the source and the selected share before copying. By default, copy the file's contents under its existing basename into that share; use a requested relative subdirectory when supplied. Keep the source in place. Reject a destination that escapes the share through `..` or symlinks, and do not transfer a symlink in place of the requested contents. Check for existing destinations, including case-only filename collisions on a Mac destination. If the same content is already present, verify its status; otherwise ask before replacing it or choose a new name only when the user authorized renaming.

Copy only the requested file, verify that the staged bytes match the source, and check that it is not excluded by ignore rules. Do not copy surrounding directories or credential files incidentally. Leave staged files in place: deleting or moving them out of a bidirectional share propagates a deletion to the peer.

Check the file's index record with the installed CLI's verified syntax:

```sh
syncthing cli --home "$HOME/.syncthing/state" debug file "$folder_id" "$relative_path"
```

Use `--help` to confirm commands for the installed version. Allow the watcher to index the file; if an immediate scan is needed, consult [POST /rest/db/scan](https://docs.syncthing.net/rest/db-scan-post.html) and scan only the selected folder and relative path. Keep API credentials out of tool output and command arguments.

Report **staged, delivery pending** until the indexed local and global versions match the staged file and there is evidence for the requested peer: either inspect matching remote bytes, or confirm that peer's non-temporary availability for the current file version. Consult [file metadata](https://docs.syncthing.net/rest/db-file-get.html) to interpret `local`, `global`, and `availability`. Folder completion alone, an existing destination, and a successful local copy do not prove receipt of newly staged bytes. Check [connections](https://docs.syncthing.net/rest/system-connections-get.html) when the peer is unavailable; do not claim delivery to an offline peer. Bound status polling to 60 seconds per request unless the user asks to wait longer, then report the pending state and leave the staged copy intact.

## Grab or locate a file

Search the selected local share first with `rg --files --hidden --no-ignore`, excluding `.stfolder`, `.stversions`, `.stignore`, and Syncthing temporary files. Search filenames and relative paths before reading contents. If several files match, show the candidates and ask which one. Confirm the candidate is a regular file inside the share, and use its index record to check for ignored, invalid, deleted, or outdated local versions before presenting it as current. If the peer is offline, describe it as the available local copy; freshness on the remote machine is unverified.

For “grab,” copy the selected file into the user's requested local destination, preserving the synced original. Apply the same collision and byte-verification rules as sending. If no destination was given, report the resolved local path and ask where to copy it. For “where is” or “find,” return the matching path without copying.

Syncthing exposes shared folders, not arbitrary files elsewhere on a peer. If the file is absent, report which share was searched; do not claim it is absent from the whole remote machine. When the user requests retrieval from outside the share, inspect existing SSH aliases in `$HOME/.dotfiles/tools/ssh/config` and confirm that an alias identifies the requested peer. Use available remote access to locate the requested file and copy it into the corresponding remote share, then wait for the local copy. Apply collision checks remotely too. Do not invent SSH hostnames, sync an entire home directory, or install remote access. If access or the remote source location is missing, explain what is needed and ask for that information.

## Report the result

State the selected computer, source path, local staged or retrieved path, expected remote path when relevant, and the observed status: located, copied locally, staged with delivery pending, or delivery verified. Include the verification used and any unresolved ambiguity. Creating this skill or finding a folder does not authorize sending a file before the user requests a transfer.
