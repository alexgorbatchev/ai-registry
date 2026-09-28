# gitsnip CLI Help Snapshot

Captured on 2026-03-18.

## `gitsnip --help`

```text
Gitsnip allows you to download a specific folder from a remote Git
repository without cloning the entire repository.

Arguments:
  repository_url: URL of the GitHub repository (e.g., https://github.com/user/repo)
  folder_path:    Path to the folder within the repository you want to download.
  output_dir:     Optional. Directory where the folder should be saved.
                  Defaults to the folder's base name in the current directory.

Usage:
  gitsnip <repository_url> <folder_path> [output_dir] [flags]
  gitsnip [command]

Available Commands:
  completion  Generate the autocompletion script for the specified shell
  help        Help about any command
  version     Print the version information

Flags:
  -b, --branch string     Repository branch to download from (default "main")
  -h, --help              help for gitsnip
  -m, --method string     Download method ('api' or 'sparse') (default "sparse")
  -p, --provider string   Repository provider ('github', more to come)
  -q, --quiet             Suppress progress output during download
  -t, --token string      GitHub API token for private repositories or increased rate limits

Use "gitsnip [command] --help" for more information about a command.
```

## `gitsnip completion --help`

```text
Generate the autocompletion script for gitsnip for the specified shell.
See each sub-command's help for details on how to use the generated script.

Usage:
  gitsnip completion [command]

Available Commands:
  bash        Generate the autocompletion script for bash
  fish        Generate the autocompletion script for fish
  powershell  Generate the autocompletion script for powershell
  zsh         Generate the autocompletion script for zsh

Flags:
  -h, --help   help for completion

Use "gitsnip completion [command] --help" for more information about a command.
```

## `gitsnip version --help`

```text
Display version, build, and other information about GitSnip.

Usage:
  gitsnip version [flags]

Flags:
  -h, --help   help for version
```

## `gitsnip completion zsh --help`

```text
Generate the autocompletion script for the zsh shell.

If shell completion is not already enabled in your environment you will need
to enable it.  You can execute the following once:

	echo "autoload -U compinit; compinit" >> ~/.zshrc

To load completions in your current shell session:

	source <(gitsnip completion zsh)

To load completions for every new session, execute once:

#### Linux:

	gitsnip completion zsh > "${fpath[1]}/_gitsnip"

#### macOS:

	gitsnip completion zsh > $(brew --prefix)/share/zsh/site-functions/_gitsnip

You will need to start a new shell for this setup to take effect.

Usage:
  gitsnip completion zsh [flags]

Flags:
  -h, --help              help for zsh
      --no-descriptions   disable completion descriptions
```
