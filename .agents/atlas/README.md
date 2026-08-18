# .agents

This directory is **for agents only**; it is not user-facing documentation.

The actual implementation of the convention (plans, progress notes,
specs, project summaries, and scratch space) lives in `atlas/`. Think of
`atlas` as the map of the project: it's where an agent goes to find out
what exists (`topics/`) and to lay out where things are headed (`plans/`).
The skill that enforces the convention lives in `skills/`.

## Layout

```
.agents/
├── skills/
│   └── atlas/
│       └── SKILL.md       # Claude Code skill that enforces this convention
└── atlas/
    ├── README.md          # this file (the convention itself)
    ├── plans/
    │   └── NN/            # one directory per plan, zero-padded number
    │       ├── PLAN.md    # the plan itself
    │       ├── PROGRESS.md    # MUST be updated at the end of every task
    │       ├── specs/*.md     # specs for long tasks (see below)
    │       └── *.md           # other supporting material for this plan
    ├── topics/
    │   └── NN-name.md     # durable project summaries, one per topic
    └── tmp/               # scratch space for temporary/in-progress files
```

## Rules

### Plans

- Plans live at `atlas/plans/NN/PLAN.md` (e.g. `atlas/plans/01/PLAN.md`).
- Each plan gets its own numbered directory `atlas/plans/NN/`.

### Progress

- Every plan directory **must** contain a `atlas/plans/NN/PROGRESS.md`.
- `PROGRESS.md` **must be updated at the end of each task**; never leave it
  stale after finishing a task.

### Topics

- `atlas/topics/NN-name.md` files hold a **durable summary of the project**
  split by topic (architecture, business logic, config schema, pipeline,
  bundle/manifest, CLI, testing/CI, status/roadmap, ...). The zero-padded
  `NN-` prefix orders them; **new topics may be added as needed** (pick
  the next number).
- Topics describe **what exists**; plans describe what to build. Topics
  are the reference an agent reads first to understand the project.
- **Before defining a new PLAN, an agent MUST read the topics**
  (`atlas/topics/NN-*.md`) to understand the current project state; the
  plan must build on them, not contradict them.
- **At the end of each PLAN, the topics MUST be updated** to reflect what
  the plan changed (new commands, config keys, invariants, status).
  Never leave topics stale after completing a plan.

### Long tasks → specs

- When a task is too long to fit comfortably in the plan, describe it as a
  **spec** in its own file inside the plan directory
  (e.g. `atlas/plans/01/specs/02-frontend-pipeline.md`).
- The plan links to the spec; the spec holds the detailed requirements.

### Working files

- Temporary files, notes, and in-progress material go under
  `.agents/atlas/tmp/`, or inside the relevant plan directory if they're
  specific to that plan.
- `.agents/atlas/tmp/` is **git-ignored** (only
  `.agents/atlas/tmp/.gitkeep` is tracked, to keep the directory present).
  Nothing placed there is committed; treat it as disposable scratch
  space. If something in `tmp/` turns out to matter, move it into a plan
  or a topic; don't rely on it surviving.

### Committing

- **Everything except `.agents/atlas/tmp/` is committed.** Plans,
  progress, specs, and topics are tracked in git; commit after every
  meaningful change, never leave uncommitted work behind.
