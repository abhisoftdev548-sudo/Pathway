# Progress rules

PathForge stores one `TaskProgress` row per learner and task. Percentages are always recomputed from the live published curriculum, so a curriculum edit never requires a migration of historical rows.

## What counts

A task is **eligible** when all of the following are true:

- the task is published and not archived
- its topic is published and not archived
- its module is published and not archived
- its roadmap is published and not archived

Archived or unpublished content is ignored. A prerequisite that points at missing, unpublished, or archived content is ignored too, so a curriculum change cannot permanently lock a learner out.

## Per roadmap, module, and topic

```
percent = completed eligible tasks / total eligible tasks × 100
```

If the denominator is 0, the percentage is 0. Values are rounded to one decimal place.

This is a **count** of tasks, not a count of minutes. A 10-minute reading and a 60-minute project each move the roadmap percentage by the same amount.

## Overall percentage

The number on the dashboard and on My Roadmaps is **time-weighted** across every non-archived enrollment (active, paused, and completed):

```
overall % = Σ estimated minutes of completed eligible tasks
            ─────────────────────────────────────────────── × 100
            Σ estimated minutes of all eligible tasks
```

Archived enrollments are excluded from the numerator and the denominator. Their `TaskProgress` rows are kept. Zero estimated minutes yields 0, never `NaN`.

A short completed roadmap therefore cannot outweigh a long roadmap the learner has barely started.

## Enrollment lifecycle

- Enrolling creates a `TaskProgress` row (`not_started`) for every eligible task. The task ids are stable, so progress survives later curriculum edits.
- Opening My Roadmaps, the dashboard, or the task list calls the same initializer again. A task published after enrollment appears on the next load, with status `not_started`, without a re-enroll.
- Completing a task sets `status=completed`, `completedAt`, and `firstCompletedAt` (only the first time). `attemptCount` increments. The percentage is recalculated immediately.
- Reopening clears `completedAt` and sets `status=in_progress`. `firstCompletedAt` and the activity log stay, so the audit trail is not rewritten. Percentages drop to match the new completed set. A completed roadmap returns to `active`.
- Archiving an enrollment sets `status=archived`. It does not delete progress. Restoring the enrollment (enroll again, or set status back to active) continues from the saved rows.
- A roadmap becomes `completed` only when every eligible task is completed. Learners cannot mark a roadmap complete by hand. Reopening any task reopens the roadmap.

## Locking

An incomplete task is locked when any of these published prerequisites are unfinished:

1. a prerequisite task
2. a prerequisite topic (every eligible task in that topic)
3. a prerequisite module (every eligible task in that module)

Already-completed tasks are never shown as locked. Locked tasks cannot be completed, and a quiz attempt on a locked task returns `409`.

## Paces and the daily plan

| Pace | Minutes reserved for that roadmap |
| --- | --- |
| Relaxed | 20 |
| Standard | 45 |
| Intensive | 90 |
| Custom | the learner's `customDailyGoal` (5–300; 30 if unset) |

The daily plan is deterministic:

1. Only **active** enrollments contribute. Only published, unlocked, incomplete tasks are candidates.
2. Tasks are taken in curriculum order (module, then topic, then task).
3. Each roadmap is capped at its pace. The first task of a roadmap is always allowed, so a single long task cannot stall the plan.
4. When several roadmaps are active, tasks are chosen round-robin from the roadmap with the fewest planned minutes.
5. Tasks are added only while they fit the remaining daily budget (`dailyGoalMinutes` minus minutes already recorded today).
6. If nothing fits but work is available, the shortest unlocked task is scheduled and the plan includes an explicit warning.
7. If today's goal is already met, the plan is empty and says so. Extra work is optional.

Completing tasks ahead of schedule only reduces what is recommended tomorrow. It does not change stored percentages.
