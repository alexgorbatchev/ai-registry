## Clustering

- Set `org.quartz.jobStore.isClustered=true` on every node that shares the tables, with the same `org.quartz.scheduler.instanceName` and a unique `instanceId` (`AUTO` generates one). Clustering requires a JDBC store.
- Never point a non-clustered scheduler at tables used by a clustered one: it treats other nodes' triggers as its own and runs recovery on them.
- Each trigger fires on exactly one node, enforced by row locks in the `<prefix>LOCKS` table. Quartz does not balance load; whichever node acquires first runs the job.
- Nodes check in every `clusterCheckinInterval` milliseconds. When a node stops checking in, another node recovers its in-flight triggers and re-runs jobs that set `requestRecovery(true)`. A long pause on a live node (GC, CPU throttling) can trigger false recovery and a duplicate execution; keep jobs idempotent.
- Keep node clocks synchronized. Fire decisions and failure detection both compare timestamps written by different nodes.
- A node that never starts its scheduler (auto-startup disabled) can still schedule and delete jobs; only started nodes acquire and execute triggers.

## Misfires

A trigger misfires when it is late by more than `org.quartz.jobStore.misfireThreshold` (default 60000 ms) because no node was running, all worker threads were busy, or the scheduler was paused. The misfire instruction decides what happens next:

| Trigger | Instruction | Effect |
| --- | --- | --- |
| One-shot `SimpleTrigger` | `withMisfireHandlingInstructionFireNow()` | Fires as soon as a node picks it up. Use for deadlines that must still be honored. |
| One-shot `SimpleTrigger` | `withMisfireHandlingInstructionNextWithRemainingCount()` | Effectively drops the missed firing. Use only when late execution is harmful. |
| Repeating `SimpleTrigger` | `...NowWithExistingCount()` / `...NextWithRemainingCount()` | Choose whether missed repetitions are compressed into one now or skipped. |
| `CronTrigger` | `withMisfireHandlingInstructionFireAndProceed()` | Fires once now, then resumes the schedule. |
| `CronTrigger` | `withMisfireHandlingInstructionDoNothing()` | Skips missed firings and waits for the next scheduled time. |
| Any | `withMisfireHandlingInstructionIgnoreMisfires()` | Fires every missed occurrence immediately. Can flood after downtime. |

The default "smart policy" varies by trigger type and repeat count; set the instruction explicitly so the behavior is visible in code.

After deploys or outages, expect a burst of `FireNow` firings. Size `threadCount` and downstream rate limits for it, or spread recovery.

## Thread pool and database load

- `org.quartz.threadPool.threadCount` caps concurrent executions per node. Jobs blocked on slow I/O hold threads and cause misfires for everything else.
- Trigger acquisition, firing, and completion use database connections and lock rows; executing job code does not hold a Quartz connection unless the job itself uses the database. Size the connection pool for those operations plus the application's own use.
- Contention on `<prefix>LOCKS` grows with node count and trigger volume. For very high volumes of short timers, consider `org.quartz.scheduler.batchTriggerAcquisitionMaxCount` with a matching `batchTriggerAcquisitionFireAheadTimeWindow`, or a different mechanism.

## Inspecting state

When diagnosing missing, late, or duplicate executions, query the tables directly (names shown with the default `QRTZ_` prefix):

- `QRTZ_TRIGGERS`: `TRIGGER_STATE` (`WAITING`, `ACQUIRED`, `BLOCKED`, `PAUSED`, `ERROR`), `NEXT_FIRE_TIME` and `PREV_FIRE_TIME` in epoch milliseconds, `MISFIRE_INSTR`.
- `QRTZ_FIRED_TRIGGERS`: firings in progress and the `INSTANCE_NAME` running them.
- `QRTZ_SCHEDULER_STATE`: live nodes and `LAST_CHECKIN_TIME`.
- `QRTZ_JOB_DETAILS`: job class, durability, `REQUESTS_RECOVERY`, and serialized `JOB_DATA`.

A trigger in `ERROR` state usually means its job class could not be loaded or instantiated; it will not fire again until fixed and resumed. Change table contents only through the `Scheduler` API, never with direct SQL writes, unless the user authorizes a repair and the scheduler is stopped on every node.
