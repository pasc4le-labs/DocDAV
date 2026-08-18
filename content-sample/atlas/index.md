---
title: Atlas — Overview
description: What Atlas is and how to use this documentation
cover: /images/atlas-cover.svg
category: Overview
order: 1
---

# Atlas

Atlas is the core platform. This documentation is split into **one folder per
product** on the drive, and each page's sidebar position is derived from its
frontmatter (`category` and `order`).

## How nav works

The sidebar is built automatically from each Markdown file's gray-matter:

```yaml
---
title: Getting started
category: Overview
order: 2
---
```

- **product** — from the top-level directory
- **category** — sidebar group
- **order** — position inside the group

> Add a file, refresh, and it appears in the sidebar. No rebuild.

## Products

| Product      | Folder          |
| ------------ | --------------- |
| Atlas        | `atlas/`        |
| Scorekeeper  | `scorekeeper/`  |
