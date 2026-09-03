# CLI Framework Setup Patterns

This reference contains boilerplate setups for the recommended CLI framework in each major programming ecosystem.

---

## TypeScript / Node / Bun: Commander

```ts
import { Command } from "commander";
import process from "node:process";

const program = new Command();

program
  .name("mytool")
  .description("Process and manage project datasets")
  .version("1.0.0");

program
  .command("sync")
  .description("Synchronize local files with the remote storage")
  .option("-f, --force", "Overwrite existing local files without prompting")
  .action(async (options) => {
    // Command implementation
  });

program.parse(process.argv);
```

---

## Go: Cobra

> To provision a new Go CLI or library project, use `go-scaffold` (available in `$PATH`).

```go
package cmd

import (
	"fmt"
	"os"

	cobrahelptree "github.com/alexgorbatchev/cobra-help-tree"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "mytool",
	Short: "Process and manage project datasets",
	Long:  "A command line tool to process, validate, and synchronize project datasets.",
}

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Synchronize local files with remote storage",
	RunE: func(cmd *cobra.Command, args []string) error {
		force, _ := cmd.Flags().GetBool("force")
		// Command implementation
		_ = force
		return nil
	},
}

func Execute() {
	// Enable hierarchical tree help screens across all command levels
	cobrahelptree.Setup(rootCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	syncCmd.Flags().BoolP("force", "f", false, "Overwrite existing local files without prompting")
	rootCmd.AddCommand(syncCmd)
}
```

---

## Python: Click / Typer

### Typer

```python
import typer

app = typer.Typer(help="Process and manage project datasets")

@app.command()
def sync(
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Overwrite existing local files without prompting",
    )
):
    """Synchronize local files with remote storage."""
    pass

if __name__ == "__main__":
    app()
```

### Click

```python
import click

@click.group()
def cli():
    """Process and manage project datasets."""
    pass

@cli.command()
@click.option(
    "--force",
    "-f",
    is_flag=True,
    help="Overwrite existing local files without prompting",
)
def sync(force: bool):
    """Synchronize local files with remote storage."""
    pass

if __name__ == "__main__":
    cli()
```

---

## Rust: Clap (Derive API)

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "mytool")]
#[command(about = "Process and manage project datasets", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Synchronize local files with remote storage
    Sync {
        /// Overwrite existing local files without prompting
        #[arg(short, long)]
        force: bool,
    },
}

fn main() {
    let cli = Cli::parse();
    match &cli.command {
        Commands::Sync { force } => {
            // Command implementation
        }
    }
}
```
