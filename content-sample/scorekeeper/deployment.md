
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
