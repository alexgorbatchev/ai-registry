# Rust CLI

Rust implementation of [CLI best practices](../cli/best-practices.md). Read that reference first; this file covers only the Rust framework choice, output patterns, and boundaries.

## Argument Parsing: clap

Use [clap](https://docs.rs/clap/latest/clap/) (derive or builder API) for new CLIs, and keep an existing CLI's established framework. Use clap's native parsing, validation, help, and error handling rather than a handwritten compatibility layer; never parse `std::env::args` manually. Query terminal width with the [terminal_size](https://docs.rs/terminal_size/latest/terminal_size/) crate.

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

## Mode Detection & Output Helper

```rust
use terminal_size::{terminal_size, Width};

pub fn is_agent_mode() -> bool {
    let value = std::env::var("AGENT").unwrap_or_default();
    matches!(value.trim().to_lowercase().as_str(), "1" | "true" | "yes")
}

pub fn terminal_width() -> usize {
    match terminal_size() {
        Some((Width(width), _)) if width > 0 => usize::from(width),
        _ => 80,
    }
}

pub fn render_divider(ch: char) {
    if is_agent_mode() {
        return;
    }
    println!("{}", ch.to_string().repeat(terminal_width()));
}
```

## Table Output Pattern

Render human tables with [comfy-table](https://docs.rs/comfy-table/latest/comfy_table/).

```rust
use comfy_table::Table;

pub struct Item {
    pub id: String,
    pub name: String,
    pub status: String,
}

pub fn render_items(items: &[Item]) {
    if is_agent_mode() {
        for item in items {
            println!("id:{} name:{} status:{}", item.id, item.name, item.status);
        }
        return;
    }

    let mut table = Table::new();
    table.set_header(vec!["ID", "Name", "Status"]);
    for item in items {
        table.add_row(vec![&item.id, &item.name, &item.status]);
    }
    println!("{table}");
}
```

## Boundaries

Keep argument parsing and output rendering at the boundary; keep domain operations callable without a terminal. Preserve stdout for results and stderr for diagnostics. Define stable machine-readable output and exit behavior where automation needs them. Test help, invalid arguments, noninteractive execution, and command failures. Do not force Rust CLI output into another language's framework conventions.
