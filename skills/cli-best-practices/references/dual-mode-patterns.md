# Dual-Mode Output Patterns

This reference provides implementation patterns across multiple programming languages for handling human vs agent (`AGENT=1`) output.

---

## TypeScript / JavaScript / Bun

### Mode Detection & Output Helper

```ts
import process from "node:process";

export function isAgentMode(): boolean {
  const agent = process.env.AGENT?.trim().toLowerCase();
  return agent === "1" || agent === "true" || agent === "yes";
}

export function getTerminalWidth(fallback = 80): number {
  return process.stdout.columns && process.stdout.columns > 0
    ? process.stdout.columns
    : fallback;
}

export function renderDivider(char = "-"): void {
  if (isAgentMode()) {
    // Agents do not want decorative divider lines
    return;
  }
  const width = getTerminalWidth();
  console.log(char.repeat(width));
}
```

### Tree Output Pattern

```ts
interface TreeNode {
  name: string;
  children?: TreeNode[];
}

export function renderTree(node: TreeNode, indent = ""): void {
  if (isAgentMode()) {
    // Token-conservative bullets
    console.log(`${indent}* ${node.name}`);
    if (node.children) {
      for (const child of node.children) {
        renderTree(child, `${indent}  `);
      }
    }
    return;
  }

  // Human mode: ASCII tree structure
  function printHuman(n: TreeNode, prefix: string, isLast: boolean): void {
    const marker = isLast ? "└── " : "├── ";
    console.log(`${prefix}${marker}${n.name}`);
    const nextPrefix = prefix + (isLast ? "    " : "│   ");
    if (n.children && n.children.length > 0) {
      n.children.forEach((child, idx) => {
        printHuman(child, nextPrefix, idx === n.children!.length - 1);
      });
    }
  }

  console.log(node.name);
  if (node.children) {
    node.children.forEach((child, idx) => {
      printHuman(child, "", idx === node.children!.length - 1);
    });
  }
}
```

### Table Output Pattern

```ts
import Table from "cli-table3";

interface RecordItem {
  id: string;
  name: string;
  status: string;
}

export function renderTable(items: RecordItem[]): void {
  if (isAgentMode()) {
    // Agent: flat, no borders, no padding
    for (const item of items) {
      console.log(`id:${item.id} name:${item.name} status:${item.status}`);
    }
    return;
  }

  // Human: formatted table via library
  const table = new Table({
    head: ["ID", "Name", "Status"],
    style: { head: ["cyan"] },
  });

  for (const item of items) {
    table.push([item.id, item.name, item.status]);
  }

  console.log(table.toString());
}
```

---

## Go

### Mode Detection & Output Helper

```go
package cliout

import (
	"fmt"
	"os"
	"strings"

	"golang.org/x/term"
)

func IsAgentMode() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("AGENT")))
	return v == "1" || v == "true" || v == "yes"
}

func RenderDivider(char rune) {
	if IsAgentMode() {
		return
	}
	width := 80
	if fd := int(os.Stdout.Fd()); term.IsTerminal(fd) {
		if w, _, err := term.GetWinsize(fd); err == nil && w > 0 {
			width = int(w)
		}
	}
	fmt.Println(strings.Repeat(string(char), width))
}
```

### Table Output Pattern

```go
package cliout

import (
	"fmt"
	"os"

	"github.com/olekukonko/tablewriter"
)

type Item struct {
	ID     string
	Name   string
	Status string
}

func RenderItems(items []Item) {
	if IsAgentMode() {
		for _, it := range items {
			fmt.Printf("id:%s name:%s status:%s\n", it.ID, it.Name, it.Status)
		}
		return
	}

	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"ID", "Name", "Status"})
	for _, it := range items {
		table.Append([]string{it.ID, it.Name, it.Status})
	}
	table.Render()
}
```

---

## Python

### Mode Detection & Helpers

```python
import os
import shutil

def is_agent_mode() -> bool:
    val = os.environ.get("AGENT", "").strip().lower()
    return val in ("1", "true", "yes")

def render_divider(char: str = "-") -> None:
    if is_agent_mode():
        return
    cols, _ = shutil.get_terminal_size(fallback=(80, 24))
    print(char * cols)
```

### Table Output Pattern

```python
from typing import List, Dict
from rich.console import Console
from rich.table import Table

def render_records(records: List[Dict[str, str]]) -> None:
    if is_agent_mode():
        for r in records:
            print(" ".join(f"{k}:{v}" for k, v in r.items()))
        return

    console = Console()
    table = Table(show_header=True, header_style="bold cyan")
    if not records:
        return
    for k in records[0].keys():
        table.add_column(k.capitalize())
    for r in records:
        table.add_row(*r.values())
    console.print(table)
```
