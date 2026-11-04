# Go CLI

Go implementation of [CLI best practices](../cli/best-practices.md). Read that reference first; this file covers only the Go framework choice and output patterns.

## Argument Parsing: Cobra

Use `github.com/spf13/cobra` with `github.com/alexgorbatchev/cobra-help-tree/v4` for tree help, positional argument documentation, `AGENT=1` help, and the `skill` command. Never use the standard library `flag` package or loop over `os.Args`. To provision a new Go CLI, use `go-scaffold` (available in `$PATH`). Follow [Go setup: Cobra CLI Setup](setup.md#4-cobra-cli-setup-tree-help--version-flag) for installation, `cobra-help-tree` features, the `--version` contract, and the complete setup template.

## Mode Detection & Output Helper

Query terminal width with `golang.org/x/term`.

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
		if w, _, err := term.GetSize(fd); err == nil && w > 0 {
			width = w
		}
	}
	fmt.Println(strings.Repeat(string(char), width))
}
```

## Table Output Pattern

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

func RenderItems(items []Item) error {
	if IsAgentMode() {
		for _, it := range items {
			fmt.Printf("id:%s name:%s status:%s\n", it.ID, it.Name, it.Status)
		}
		return nil
	}

	table := tablewriter.NewWriter(os.Stdout)
	table.Header("ID", "Name", "Status")
	for _, it := range items {
		if err := table.Append(it.ID, it.Name, it.Status); err != nil {
			return err
		}
	}
	return table.Render()
}
```
