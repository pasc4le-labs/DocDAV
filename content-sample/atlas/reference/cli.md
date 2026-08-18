---
title: CLI reference
description: All Atlas commands
category: CLI Reference
order: 1
---

# CLI reference

## `atlas init`

Scaffolds a new project in the current directory.

```bash
atlas init [--template <name>] [--yes]
```

## `atlas run`

Starts the local dev server.

```bash
atlas run --port 8787 --watch
```

## `atlas build`

Compiles the project for production.

| Flag       | Description              |
| ---------- | ------------------------ |
| `--minify` | Minify the bundle        |
| `--out`    | Output directory         |
