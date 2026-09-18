---
name: git-ignore
description: Use to decide if files be added to git or ignored?
author: alexgorbatchev
metadata:
  created_on: 2026-07-20 22:30
  last_modified: 2026-08-03 12:56
  status: current
---

The following files/folders should always be added to .gitignore if they are present in the project:

.pi-subagents
.codegraph
.tmp
.cache
.dist or dist
*.sqlite-wal and *.sqlite-shm

