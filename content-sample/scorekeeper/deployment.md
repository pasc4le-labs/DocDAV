---
title: Deployment
description: Deploy Scorekeeper to Vercel
category: Operations
order: 1
---

# Deployment

Scorekeeper deploys to **Vercel** after every feature.

```bash
vercel --prod --yes
```

## Environment

| Variable   | Required | Purpose          |
| ---------- | -------- | ---------------- |
| `DATABASE` | yes      | Postgres URL     |
| `PUBLIC_WS`| no       | Websocket origin |
