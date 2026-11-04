# TypeScript CLI

TypeScript implementation of [CLI best practices](../cli/best-practices.md). Read that reference first; this file covers only the TypeScript framework choice and output patterns.

## Contents

- [Argument Parsing: Commander](#argument-parsing-commander)
- [Mode Detection & Output Helper](#mode-detection--output-helper)
- [Tree Output Pattern](#tree-output-pattern)
- [Table Output Pattern](#table-output-pattern)

## Argument Parsing: Commander

Use `commander`, `citty`, or `yargs`. Never slice `process.argv` or parse it with regex loops. Query terminal width with `process.stdout.columns`.

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

## Mode Detection & Output Helper

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

## Tree Output Pattern

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

## Table Output Pattern

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
