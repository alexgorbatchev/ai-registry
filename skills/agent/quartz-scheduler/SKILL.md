---
name: quartz-scheduler
description: >-
  Use when designing, implementing, configuring, debugging, or reviewing Quartz
  Scheduler jobs and triggers in JVM applications, including Spring Boot
  `spring.quartz` configuration, JDBC job stores and `qrtz_` tables, clustered
  schedulers, misfire handling, and scheduling, rescheduling, or cancelling
  persistent timers.
author: alexgorbatchev
metadata:
  created_on: 2026-11-10 13:50
  last_modified: 2026-11-10 13:50
  status: current
---

## Establish the setup

Before changing or explaining Quartz behavior, read the project's actual wiring instead of assuming defaults:

1. Quartz version from the build file, and whether it is wired by Spring Boot auto-configuration, a custom `SchedulerFactoryBean`, or `StdSchedulerFactory` directly.
2. Job store (`RAMJobStore` or JDBC), clustering flag, thread count, misfire threshold, table prefix, and the schema source (migration tool or `initialize-schema`).
3. Which processes start the scheduler and which only write to it (`autoStartup`, profiles, separate deployments).
4. Every `Job` implementation and every call site that schedules, reschedules, or deletes jobs.

For Spring wiring, load [Spring integration](references/spring.md) before reasoning about which data source, job store class, or job factory is actually in effect: Spring overrides several `org.quartz.*` properties silently. For JDBC stores, clustering, or misfires, load [JDBC store and clustering](references/jdbc-clustering.md) before changing configuration or diagnosing duplicate, missing, or late executions.

Quartz.NET shares the model but not the API or configuration names; verify names against its documentation before applying this skill there.

## Decide whether Quartz fits

- Use Quartz for durable timers that must survive restarts, run once across a cluster, and be rescheduled or cancelled per entity (per user, order, session).
- Prefer the framework's in-process scheduler plus a distributed lock for a handful of fixed periodic tasks, and a message queue with delayed delivery for high-volume fire-and-forget work. Raise the tradeoff instead of adding Quartz tables for those.
- A JDBC store needs a database the service owns or is permitted to write. Confirm that before adding one.

## Design jobs

- Give every job you may later look up, reschedule, or cancel a deterministic `JobKey` and `TriggerKey` derived from the business identity, in a named group. Build keys in one function shared by schedule, reschedule, and cancel paths; any divergence produces jobs that can never be cancelled. Generated random keys are acceptable only for fire-and-forget work.
- Store only small string values in `JobDataMap`, converting numbers explicitly, and set `org.quartz.jobStore.useProperties=true` for new JDBC setups; Quartz then rejects non-string values at scheduling time. Without it, every value is Java-serialized into the database, and renaming or changing a stored class breaks deserialization of already-persisted jobs. Load large payloads from the system of record at execution time using an identifier.
- Treat every `JobDataMap` field as a persisted contract. When changing a key name or value type, keep the job able to read jobs written by the previous version until they have all fired. Enabling `useProperties` on an existing store is such a change: jobs already stored with non-string values must still be readable.
- Make `execute` idempotent and re-check current state before acting: by the time a trigger fires, the entity may already be closed, deleted, or handled by another path. Use a distributed lock or a conditional write when another code path can perform the same action concurrently.
- Use `@DisallowConcurrentExecution` when two firings of the same `JobKey` must not overlap; it does not serialize different keys. Use `@PersistJobDataAfterExecution` only when the job intentionally mutates its own data.
- Set `requestRecovery(true)` only for idempotent jobs that must re-run after a node dies mid-execution.
- Use `storeDurably(false)` for one-shot jobs so Quartz deletes the job once its last trigger completes. Adding a job without a trigger requires `storeDurably(true)`.

## Schedule, reschedule, and cancel

- Do not implement create-or-update as `getJobDetail` followed by `scheduleJob`: concurrent callers on different nodes race, and the loser gets `ObjectAlreadyExistsException`. Use `scheduleJob(jobDetail, setOf(trigger), replace = true)`, or handle `ObjectAlreadyExistsException` by rescheduling.
- `rescheduleJob(triggerKey, newTrigger)` returns `null` when the trigger no longer exists, for example because it already fired. Handle that result; do not assume the job is still pending.
- The new trigger in `rescheduleJob` must target the same job (`forJob(jobKey)`) and should keep the same `TriggerKey`.
- `deleteJob(jobKey)` removes the job and all its triggers and returns `false` if nothing existed. Treat `false` as "already fired or never scheduled", not as an error, unless the caller requires the job to exist.
- When a deadline may only move later, read `getTrigger(triggerKey)?.nextFireTime` and compare before rescheduling; the read-compare-write is not atomic across nodes, so guard it with a lock when concurrent updates are possible.
- Set an explicit misfire instruction on every trigger. The rules are in [JDBC store and clustering](references/jdbc-clustering.md).
- Use `startAt(Date.from(instant))` for absolute instants. For calendar schedules, set the time zone on the cron schedule explicitly; the JVM default is rarely the intended zone.

## Handle failures

- An exception thrown from `execute` completes the firing as failed. Quartz does not retry it; a one-shot trigger is then gone. Choose explicitly:
  - Throw `JobExecutionException(e, refireImmediately = true)` only for brief transient faults; it refires without delay and can loop.
  - For retry with delay, schedule a new trigger for the same job with a capped attempt count stored in the job data, then return normally.
  - Otherwise log the failure with the job and trigger keys and the business identifiers, so the stuck entity can be found.
- Log `context.fireTime` against `context.scheduledFireTime` to measure scheduler lag, and `context.refireCount` for retries.
- Bridging coroutines or async code with a blocking call inside `execute` is acceptable; it occupies a Quartz worker thread for the duration, so size `threadCount` accordingly. Implement `InterruptableJob` when long jobs must stop on shutdown.

## Test and verify

- Unit-test scheduling logic against a mocked or in-memory `Scheduler`: assert the exact keys, fire time, misfire instruction, and job data for create, reschedule, push-back, and cancel paths, including the key-builder shared by them.
- Test `execute` directly with a constructed `JobExecutionContext` or mock, including missing, blank, and legacy-typed job data.
- Use `RAMJobStore` for fast tests only. Verify JDBC persistence, migrations, and clustering against the real database engine (for example in a container), because delegate, schema, and locking behavior differ.
- After changing configuration, start the application and confirm in logs that the scheduler reports the intended job store class, clustering mode, thread count, and instance ID.

## Review checklist

When reviewing Quartz code or configuration, check each item, then fix confirmed defects within the task's authorization:

- Key builders are shared and stable; schedule, reschedule, and cancel paths cannot diverge.
- Create-or-update paths are race-free across nodes.
- Every trigger has an intentional misfire instruction.
- Job data is small and string-valued, and remains readable for jobs persisted by the previous release.
- Failures are handled deliberately rather than silently dropping one-shot work.
- Configured `org.quartz.*` properties are actually in effect under the project's wiring; remove dead entries such as unused `org.quartz.dataSource.*` blocks, which can still create idle connection pools.
- The database pool can serve Quartz alongside the application's own load.
- Only intended processes start the scheduler, and shutdown waits long enough for running jobs.
