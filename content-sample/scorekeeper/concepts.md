---
title: Concepts
description: Core concepts behind the scoring engine
category: Concepts
order: 1
---

# Concepts

## Scoreboard model

Each match has players, turns and a running total:

```ts
interface Match {
  id: string;
  players: Player[];
  currentTurn: number;
}
```

## Real-time updates

Updates flow over a websocket and are applied optimistically to every client.
