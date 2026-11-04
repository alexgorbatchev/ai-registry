---
name: git-ignore
description: Use to decide if files be added to git or ignored?
author: alexgorbatchev
metadata:
  created_on: 2026-07-20 22:30
  last_modified: 2026-11-04 12:08
  status: current
---

The following files/folders should always be added to .gitignore if they are present in the project:

.pi-subagents
.tmp
.cache
.dist or dist
*.sqlite-wal and *.sqlite-shm

