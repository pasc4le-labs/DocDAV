
# Getting started

> [!BANNER] Welcome to Atlas
> The fastest way from zero to a running service. Everything here is editable —
> just change the Markdown on your drive and refresh.

## Install

> [!NOTE]
> You'll need **Node 20+** on the PATH. Don't have it? Grab it from
> [nodejs.org](https://nodejs.org) first.

```bash
npm install -g @atlas/cli
```

## Initialize

1. Create a project folder.
2. Run `atlas init` to scaffold the config.
3. Start the dev server with `atlas run`.

```bash
atlas init
atlas run
```

> [!TIP]
> The dev server watches the config and hot-reloads queries, so you rarely need
> to restart it during iteration.

## First request

```js
const client = new AtlasClient({ endpoint: "http://localhost:8787" });
const res = await client.health();
console.log(res.status); // "ok"
```

Now open your browser — the service is running.

:::toggle Something wrong?
If the health check doesn't return `ok`, make sure `atlas run` is still alive in
its terminal and that nothing else is bound to port 8787. See the
[command reference](reference/cli) for common flags and fixes.
:::

