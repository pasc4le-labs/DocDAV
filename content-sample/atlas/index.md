# Atlas

Atlas is the core platform. This documentation is split into **one folder per
product** on the drive, and each product's pages are declared in a `docs.yaml`
manifest at the product root.

## How nav works

The sidebar is built from the product's `docs.yaml` manifest — every page must
be listed there, and its sidebar position and category come from the manifest:

```yaml
# docs.yaml
title: Atlas
description: Our flagship platform.
pages:
  - title: Getting started
    source: getting-started.md
    category: Overview
```

- **product** — from the top-level directory
- **category** — sidebar group, from the manifest (default `General`)
- **order** — the page's position in the `pages` list

> Add a page to the manifest, refresh, and it appears in the sidebar. Files not
> listed in the manifest are ignored.
