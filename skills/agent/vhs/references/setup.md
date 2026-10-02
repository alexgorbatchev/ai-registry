# Setup and execution environments

## Install and verify

Use a package manager or the appropriate prebuilt binary from [VHS releases](https://github.com/charmbracelet/vhs/releases). Select the operating system and architecture, verify the release checksum, and put the binary on PATH. VHS also needs `ffmpeg`, **ttyd >= 1.7.2**, and its platform default shell available even when selecting another render shell. Ensure the FFmpeg build contains the encoders and filters required for selected output formats. A Chromium-compatible browser is used through go-rod; VHS looks for an installed candidate, then can download one.

Common upstream-supported package choices:

```sh
# Homebrew (macOS/Linux)
brew install vhs ttyd ffmpeg

# Arch Linux
sudo pacman -S vhs ttyd ffmpeg

# Windows alternatives
winget install charmbracelet.vhs
scoop install vhs
```

On other distributions, use the upstream release's DEB/RPM package or a maintained distribution package and install ttyd/FFmpeg separately. Consult the package's current installation instructions instead of inventing repository signing-key commands. A VHS binary by itself does not establish that dependencies or fonts are present.

```sh
command -v vhs ttyd ffmpeg bash
vhs --version
ttyd --version
ffmpeg -version
ffmpeg -encoders
ffmpeg -filters
```

Use the native executable lookup on Windows. Also check the specific selected shell, application binary, chosen font, locale, writable output directory, and working directory. Document their versions when comparing runs.

## Containers

The [upstream container](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/Dockerfile) bundles recording dependencies. Run with the project mounted at its `/vhs` work directory:

```sh
docker run --rm -v "$PWD:/vhs" ghcr.io/charmbracelet/vhs demo.tape
```

For reproducible automation, resolve and pin the image digest after checking the available upstream image. Do not assume that a release tag exists on the registry. The target application must be installed inside the image or provided as an executable compatible with its OS/architecture; mounting a macOS binary does not make it runnable in Linux. Mount only the fixture/output files needed for the task. Files written through the mount can have container-user ownership. A mounted writable host project remains writable by the tape's shell commands.

Fonts inside the container may differ from the host. Install the selected font in a derived image if needed. Clipboard operations may lack a usable clipboard service; use Type for deterministic automation.

## Remote rendering and SSH service

`vhs serve` listens on localhost:1976 by default and accepts tape content on SSH stdin **without a PTY**. It executes in the server's environment; a tape's local binaries and relative files are not transferred by SSH.

```sh
# Server in an environment prepared for arbitrary tape execution
VHS_HOST=localhost VHS_PORT=1976 vhs serve

# Client, using an authorized account and verified SSH host key
ssh -T -p 1976 localhost < demo.tape > demo.gif
```

Session stderr carries diagnostics; stdout contains media bytes. If the tape requests MP4, the service returns MP4; otherwise it prefers WebM, then GIF. It renders only the selected primary video slot to a temporary path. Name the redirected result accordingly, check the SSH exit code, and inspect the file signature before using it. Screenshot/text/raw-frame outputs remain server-side side effects; do not expect them to arrive as additional SSH streams.

Configure `VHS_KEY_PATH`, `VHS_AUTHORIZED_KEYS_PATH`, `VHS_HOST`, `VHS_PORT`, `VHS_UID`, and `VHS_GID` as described in the CLI reference. Empty authorized-keys configuration has no explicit key restriction. Serving accepts command-executing tapes; before binding beyond loopback, supply authentication and OS/container isolation appropriate to that execution. UID/GID dropping alone does not isolate the filesystem or network.

The upstream project documents a hosted SSH rendering endpoint at `vhs.charm.sh`; availability and installed applications are external service conditions. Verify them before depending on that service, and obtain authorization before transmitting a tape or its data. Local VHS operation does not require either hosted rendering or publication.

## Editor support

`.tape` files are plain text. [tree-sitter-vhs](https://github.com/charmbracelet/tree-sitter-vhs) provides an upstream syntax-highlighting grammar. Highlighting does not replace `vhs validate` and a real render; verify editor grammar compatibility with the installed VHS version.
