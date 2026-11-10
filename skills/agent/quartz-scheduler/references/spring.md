## Determine the effective wiring

- With `spring-boot-starter-quartz` and no user-defined `SchedulerFactoryBean`, Spring Boot's auto-configuration builds the scheduler from `spring.quartz.*`. A user-defined `SchedulerFactoryBean` disables that auto-configuration; then only what the bean sets applies, plus any `SchedulerFactoryBeanCustomizer` beans the configuration explicitly honors.
- Profile-restricted custom configuration is a trap: when the custom bean is inactive in some profile, Boot's auto-configuration silently takes over with different behavior in that profile. Check every deployed profile.
- Boot registers every `JobDetail`, `Trigger`, and `Calendar` bean with the scheduler at startup. `spring.quartz.overwrite-existing-jobs` controls whether those definitions replace stored ones; set it to `true` when code is the source of truth for static jobs.

## Data source and job store

- `spring.quartz.job-store-type=jdbc` makes Boot pass a Spring `DataSource` to `SchedulerFactoryBean`: the one annotated `@QuartzDataSource` if present, otherwise the primary application `DataSource`.
- When `SchedulerFactoryBean` has a `DataSource`, Spring forces `org.quartz.jobStore.class` to `LocalDataSourceJobStore`, ignoring any configured `JobStoreTX` or `JobStoreCMT`. `org.quartz.jobStore.dataSource` and the named `org.quartz.dataSource.<name>.*` connection settings are then not used by the job store.
- Remove such dead `org.quartz.dataSource.*` blocks. Quartz may still instantiate a connection pool for each declared data source, holding idle connections for nothing, and readers will assume the scheduler uses that database.
- To give Quartz a separate database or pool, define a second `DataSource` bean annotated `@QuartzDataSource` instead of `org.quartz.dataSource.*` properties. Use `@QuartzTransactionManager` if it needs its own transaction manager.
- With `LocalDataSourceJobStore`, Quartz borrows from that Spring pool. Size the pool for the scheduler's acquisition and completion work in addition to the application's own use.

## Schema

- `spring.quartz.jdbc.initialize-schema` defaults to `embedded`. Set it to `never` for real databases and create the tables with the project's migration tool, copying the script for the matching Quartz version and database from the Quartz distribution (`org/quartz/impl/jdbcjobstore/tables_<db>.sql`).
- Keep `org.quartz.jobStore.tablePrefix` consistent with the migration. Unquoted identifiers are case-folded by some databases, so prefix case may or may not matter; quoted identifiers make it significant.

## Job instantiation

- Boot configures a `SpringBeanJobFactory` with the application context. It creates a new job instance per firing through the bean factory, so constructor and field injection work, and it binds matching `JobDataMap` entries to job setters.
- The job instance is not the Spring singleton. Annotating a `Job` with `@Component` only creates an extra unused bean, and any state on the singleton is invisible to executions. Keep jobs stateless and put collaborators in injected services.
- A custom factory that calls `autowireBean` on the created instance supports field injection only; constructor injection then depends on the parent factory's instantiation.

## Lifecycle

- `spring.quartz.auto-startup=false` (or `setAutoStartup(false)`) keeps a process from executing jobs while still allowing it to schedule, reschedule, and delete them through the shared JDBC store. Use it for processes that only produce work.
- `spring.quartz.startup-delay` delays execution after context refresh, which avoids firing jobs before dependencies are ready.
- `spring.quartz.wait-for-jobs-to-complete-on-shutdown=true` blocks shutdown until running jobs finish; the platform's termination grace period must exceed the longest job, or the process is killed mid-job.
- Exclude or replace the scheduler in tests by profile, or use `job-store-type=memory`, so tests do not need the database or fire real jobs.
