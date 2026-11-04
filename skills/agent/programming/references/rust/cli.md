# Rust CLI

Rust implementation of [CLI best practices](../cli/best-practices.md). Read that reference first; this file covers only the Rust framework choice and boundaries.

## Argument Parsing: clap

Use [clap](https://docs.rs/clap/latest/clap/) (derive or builder API) for new CLIs, and keep an existing CLI's established framework. Use clap's native parsing, validation, help, and error handling rather than a handwritten compatibility layer; never parse `std::env::args` manually.

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

## Boundaries

Keep argument parsing and output rendering at the boundary; keep domain operations callable without a terminal. Preserve stdout for results and stderr for diagnostics. Define stable machine-readable output and exit behavior where automation needs them. Test help, invalid arguments, noninteractive execution, and command failures. Do not force Rust CLI output into another language's framework conventions.
