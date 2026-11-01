# Message Delivery In Headless Agent CLIs

Created: 2026-10-30
Last updated: 2026-10-30

## Original Prompt

> k, we need to research how other tools handle headless mode, there are lots of them out there

Scope added for this report: how tools driving Claude Code, Codex and similar CLIs handle a message sent during an active turn, delivery acknowledgement, ambiguous delivery, retries, approvals, reconnects, and concurrent agents. The decision to support is what devhost's native chat should do when a Claude Code send has no `--replay-user-messages` echo after 30 seconds, and whether a request should join a running session or start a second one.

## Executive Summary

- A late echo is normal, not a fault. On Claude Code 2.1.310 the echo for a message written mid-turn arrived 43.5 seconds later during a long tool and 38.4 seconds later during an approval (see [Experiments](#experiments)). devhost's 30-second limit reports those delivered messages as failed.
- Claude Code has a better signal than the echo. Since 2.1.206 it emits `command_lifecycle` frames, including `queued` at receipt, `started` at pickup, and terminal states ([claude-agent-acp](https://github.com/agentclientprotocol/claude-agent-acp/blob/eb78afa8556b8fc4082495e48e3fd1762fb6a50f/src/acp-agent.ts#L6093)). In the measured run `queued` arrived at the same logged tenth of a second as the stdin write. The frame is `@internal`, so it needs a fallback.
- The tools that model ambiguous delivery do not resend it. Orca, Zed, acpx and the Codex TUI treat "unknown" as its own state and leave retry to the user; acpx says "Do not automatically resubmit". t3code is the exception: its [outbox tries five times](https://github.com/pingdotgg/t3code/blob/cb9629e6891ef0745772b69f09c9acd0c6a74f7e/apps/server/src/orchestration-v2/EffectWorker.ts#L648), and it has a [reported replay-under-a-new-ID bug](https://github.com/pingdotgg/t3code/issues/16182).
- Joining beats starting a second agent when the running session is one the tool owns. No examined tool attaches to a CLI it did not start.

## Short Answer Or Recommendation

1. Treat `command_lifecycle` `queued` for the sent UUID as delivery acknowledgement, and let the echo or `started` mark pickup.
2. Where lifecycle frames are unavailable, a successful stdin write without an echo becomes **unconfirmed**, never failed. A late echo still settles it.
3. Never resend automatically, on either harness. Retry is a user action after a definite failure, or after the user has seen an unconfirmed state.
4. Before starting a session for a programmatic request, join the running session devhost owns in that project. Name the session it joined.

## Experiments

Run on 2026-10-30 against Claude Code 2.1.310, with devhost's flags, model `haiku`, `--no-session-persistence` (except the resend case), and a disposable directory. Each case ran once, except the same-UUID mid-turn case, which ran twice with different payloads. Times are from the driver's clock, so these show ordering and rough magnitude, not guarantees.

| ID | Scenario | Message written | Observed | Echo delay |
| --- | --- | --- | --- | --- |
| E1 | Idle, first prompt | 0.0s | Echo 3.2s to 10.1s across runs; slower with parallel cold starts | Startup-dependent |
| E2 | Mid-turn during a 45s tool | 13.7s | Echo at 57.2s, same tenth as `tool_result`; the turn answered it | 43.5s |
| E3 | Mid-turn with a pending approval | 9.3s | Approved at 46.3s; echo at 47.7s, after `tool_result` | 38.4s |
| E4 | Two UUIDs mid-turn | 6.2s, 7.2s | `queued` frame for each at write time; `started` and echo for both at 24.0s; both answered in one turn | 17.8s, 16.8s |
| E5 | Same UUID mid-turn, different text | 9.7s, 10.7s | One echo; second text never answered, no error | 18.7s |
| E6 | Same UUID after the first completed, different text | 6.3s | Echoed at once, but no reply and no `result` in the next 33 seconds | 0s |
| E7 | Interrupt with a message queued | 10.5s; interrupt 15.5s | `result` `error_during_execution` at 15.7s, then echo at 18.2s and a new turn answered it | 7.7s |

What these establish:

- The echo marks pickup, not receipt. This was already suggested by [Agent SDK documentation of `next` priority](https://code.claude.com/docs/en/agent-sdk/typescript#sdkusermessage) and a [maintainer comment](https://github.com/anthropics/claude-agent-sdk-typescript/issues/143#issuecomment-4056911737); E2 and E3 measure it.
- An echo does not prove a turn ran (E6), and "the turn ended" does not mean a queued message is gone (E7). Any rule of the form "wait until the turn ends, then assume" is wrong.
- UUID dedupe exists in practice (E5, E6), but no document, changelog entry or issue I found guarantees it. E6 makes a same-UUID retry actively misleading, because it gets a success-shaped echo while nothing runs.

## Rating System

Each score is 1 to 10, higher is better. **Safety** is resistance to duplicate or falsely failed messages. **Honesty** is how accurately the UI states what happened. **Latency** is time until the composer is released. **Resilience** is survival across CLI versions and reconnects. **Simplicity** is implementation cost.

| ID | Policy | Safety | Honesty | Latency | Resilience | Simplicity |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Echo with timeout means failed (devhost today) | 3 | 2 | 4 | 6 | 9 |
| P2 | Timeout then automatic resend | 1 | 2 | 4 | 3 | 7 |
| P3 | Hold in client until turn ends, then send | 8 | 7 | 9 | 7 | 6 |
| P4 | Evidence-settled states with lifecycle frames and echo fallback | 9 | 9 | 9 | 7 | 5 |
| P5 | Write counts as sent, no tracking | 4 | 3 | 10 | 8 | 10 |

P3 scores well but defeats steering, which the hot reload request needs: the point is to reach the agent while it works. P4 loses resilience points only because `command_lifecycle` is internal.

## Compared Approaches

### Claude Code And The Agent SDK

- Neither SDK waits for delivery, has an ack timeout, or retries: TypeScript `streamInput` writes to the transport and Python's [`client.query`](https://github.com/anthropics/claude-agent-sdk-python/blob/1ea8cb74ddcdadbfaa9b20dfa8268e18047851e7/src/claude_agent_sdk/client.py#L272) does the same.
- The stdin contract is largely undocumented: the [CLI reference](https://code.claude.com/docs/en/cli-reference) gives one line on the flag, and [a docs request](https://github.com/anthropics/claude-code/issues/44911) closed as not planned.
- The [interrupt receipt docs](https://code.claude.com/docs/en/agent-sdk/typescript#sdkcontrolinterruptresponse) list `still_queued` and warn that "resending it delivers it to Claude twice". `cancel_queued: true` cancels queued work and needs the `interrupt_cancel_queued_v1` capability ([SDK types](https://unpkg.com/@anthropic-ai/claude-agent-sdk@0.3.314/sdk.d.ts)).
- [`canUseTool` can stay pending indefinitely](https://code.claude.com/docs/en/agent-sdk/user-input), which explains E3.
- [Resuming one session from two processes interleaves transcripts](https://code.claude.com/docs/en/sessions), and [`user_message_uuids`](https://code.claude.com/docs/en/agent-sdk/typescript#user_message_uuids) on results is a second join key.
- `command_lifecycle` is `@internal` and absent from the `SDKMessage` union. The adapter lists `queued`, `started`, `completed`, `cancelled`, `discarded`, `refused` and gates on `msg_lifecycle_v1` from `system/init` ([source](https://github.com/agentclientprotocol/claude-agent-acp/blob/eb78afa8556b8fc4082495e48e3fd1762fb6a50f/src/acp-agent.ts#L6093)). I measured `queued`, `started`, `completed` only.

### Codex App-Server

- `turn/steer` success means queued: ["Started and Steered only mean Core accepted the input"](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/protocol/src/turn_input.rs#L240). Consumption shows as a [userMessage item carrying the client ID](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/core/src/session/mod.rs#L5392), emitted when input is [drained before the next model request](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/core/src/session/turn.rs#L464).
- There is no idempotency: [`clientUserMessageId`](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/app-server-protocol/src/protocol/v2/turn.rs#L320) is correlation only, and [#32254](https://github.com/openai/codex/issues/32254) requests dedupe.
- Interrupt [clears pending input](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/core/src/tasks/mod.rs#L586), the opposite of Claude Code's E7.
- The TUI's [rejection handling](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/tui/src/app/user_turn_submission.rs#L53) falls through to a new turn on "no active turn" and retries once on a turn ID mismatch, reusing the client ID. Across reconnects, pending steers become [`Unconfirmed`](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/tui/src/chatwidget/input_restore.rs#L700).
- [`turn/start` also steers an active turn](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/app-server/src/request_processors/turn_processor.rs#L662), with no turn precondition.
- [Stdio is single-client](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/app-server/src/lib.rs#L815); `thread/resume` on a loaded thread [rejoins it](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/app-server/src/request_processors/thread_processor.rs#L4582) over a shared transport.
- OpenAI lists ["Running live tasks on the same files without using Git worktrees"](https://learn.chatgpt.com/guides/best-practices) as a mistake.

### ACP And Protocol Adapters

| ID | Tool | Prompt during a turn | Acknowledgement | Notable behavior |
| --- | --- | --- | --- | --- |
| T1 | ACP v2 draft | [Must not reject for activity](https://github.com/agentclientprotocol/agent-client-protocol/blob/a965f1f14e06865bee5da58f009c789ab9f630e5/docs/protocol/v2/draft/prompt-lifecycle.mdx#L373) | [At insertion, not receipt](https://github.com/agentclientprotocol/agent-client-protocol/blob/a965f1f14e06865bee5da58f009c789ab9f630e5/docs/protocol/v2/draft/prompt-lifecycle.mdx#L314) | [A retry after a lost response can duplicate](https://github.com/agentclientprotocol/agent-client-protocol/blob/a965f1f14e06865bee5da58f009c789ab9f630e5/docs/rfds/v2/prompt.mdx#L393) |
| T2 | claude-agent-acp 0.99.1 | [Queued FIFO](https://github.com/agentclientprotocol/claude-agent-acp/blob/eb78afa8556b8fc4082495e48e3fd1762fb6a50f/src/acp-agent.ts#L4111), plus `_session/steering` | [`started`, else echo or result](https://github.com/agentclientprotocol/claude-agent-acp/blob/eb78afa8556b8fc4082495e48e3fd1762fb6a50f/src/turn-events.ts#L14) | No delivery timeout; [steer drops from `now` to `later` with a permission open](https://github.com/agentclientprotocol/claude-agent-acp/blob/eb78afa8556b8fc4082495e48e3fd1762fb6a50f/src/acp-agent.ts#L4586) |
| T3 | Zed 1.28.0 | [Client queue](https://github.com/zed-industries/zed/blob/14b7b0ef3764d62a85070c8b5ccea105a2ad3235/crates/agent_ui/src/conversation_view/thread_view.rs#L2214) | [`SubmissionState`](https://github.com/zed-industries/zed/blob/14b7b0ef3764d62a85070c8b5ccea105a2ad3235/crates/acp_thread/src/submission.rs#L112) | Disconnected without receipt means acceptance is unknown |
| T4 | codex-acp 2.5.0 | [FIFO](https://github.com/agentclientprotocol/codex-acp/blob/580d8b926b3350ae8a3c74d54da81df311601d85/src/CodexAcpServer.ts#L4537), steer via extension | [Echoed `clientUserMessageId`](https://github.com/agentclientprotocol/codex-acp/blob/580d8b926b3350ae8a3c74d54da81df311601d85/src/AcpV2Prompt.ts#L45) | [Undelivered steers dropped at completion](https://github.com/agentclientprotocol/codex-acp/blob/580d8b926b3350ae8a3c74d54da81df311601d85/src/CodexAcpServer.ts#L1784) |
| T5 | Gemini CLI nightly | [Aborts the running prompt](https://github.com/google-gemini/gemini-cli/blob/6814e00d6b148c3a1d57244d5d7040f7c541009d/packages/cli/src/acp/acpSession.ts#L320) | Turn end | Headless stdin is one-shot |
| T6 | OpenCode 2.2.4 | [Default `steer`](https://github.com/anomalyco/opencode/blob/958f965d35ed44d32b018fd55b02a5357a7748fd/packages/core/src/session/session.ts#L165) | Durable admission | [Client ID, first admission wins](https://github.com/anomalyco/opencode/blob/958f965d35ed44d32b018fd55b02a5357a7748fd/packages/core/src/session/inbox.ts#L176): the only real idempotency key found |
| T7 | acpx 0.21.1 | [Owner FIFO over IPC](https://github.com/openclaw/acpx/blob/6ce38c34f4e5aef16bf28ca8b1fb1e6650695c60/docs/prompting.md#L92) | Owner ack | [`outcome unknown`: "Do not automatically resubmit"](https://github.com/openclaw/acpx/blob/6ce38c34f4e5aef16bf28ca8b1fb1e6650695c60/src/session/queue/ipc.ts#L116) |
| T8 | Goose 1.57.0 | [Rejected, pointing to steer](https://github.com/block/goose/blob/6ec4e9a2abc0fdb13f8af2676ceaf848a1df716f/crates/goose/src/acp/server.rs#L1829) | Steer response | [`expected_run_id`](https://github.com/block/goose/blob/6ec4e9a2abc0fdb13f8af2676ceaf848a1df716f/crates/goose/src/acp/server.rs#L2294) compare-and-swap |

### Third-Party GUIs

- **Orca** is the closest match and the most thorough. It [admits a message on write because the echo may wait for the turn](https://github.com/stablyai/orca/blob/b586ef9453acfc1332724c6c16f0f8f4a86d3875/src/main/claude/claude-structured-dispatch.ts#L240), settles [only on provider or process evidence, "never time"](https://github.com/stablyai/orca/blob/b586ef9453acfc1332724c6c16f0f8f4a86d3875/src/main/claude/claude-structured-dispatch-waiters.ts#L15), [never lets unknown authorize redelivery](https://github.com/stablyai/orca/blob/b586ef9453acfc1332724c6c16f0f8f4a86d3875/src/main/native-chat/agent-session-journal/journal-dispatch-doubt-reasons.ts#L1), and shows ["Delivery unconfirmed — check chat before retrying"](https://github.com/stablyai/orca/blob/b586ef9453acfc1332724c6c16f0f8f4a86d3875/src/renderer/src/components/native-chat/use-native-chat-pending-delivery.ts#L170). It got there through bugs: [a lost ack shown as failure was retried twice](https://github.com/stablyai/orca/pull/9792).
- **vibe-kanban** avoids the problem: [one process per turn](https://github.com/BloopAI/vibe-kanban/blob/7c3807084daad0d9d315064f60fa869de254f027/crates/executors/src/executors/claude.rs#L360) and a [one-slot server queue](https://github.com/BloopAI/vibe-kanban/blob/7c3807084daad0d9d315064f60fa869de254f027/crates/services/src/services/queued_message.rs#L45). It has no mid-turn input.
- **t3code** steers with [priority `now`, which cancels foreground tools](https://github.com/pingdotgg/t3code/blob/cb9629e6891ef0745772b69f09c9acd0c6a74f7e/apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts#L10767) and treats a steer as [done on queue offer](https://github.com/pingdotgg/t3code/blob/cb9629e6891ef0745772b69f09c9acd0c6a74f7e/apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts#L10894). A steer that misses the turn [becomes a follow-up with the same IDs](https://github.com/pingdotgg/t3code/blob/cb9629e6891ef0745772b69f09c9acd0c6a74f7e/apps/server/src/orchestration-v2/EffectWorker.ts#L281). Reported costs include [lost steers](https://github.com/pingdotgg/t3code/issues/22423) and [aborted auto-compaction](https://github.com/pingdotgg/t3code/issues/25796).
- **Happy** separates [outbox from agent](https://github.com/slopus/happy/blob/e0170eac6494d12a5b95128f39bae2a823712bb6/packages/happy-app/sources/sync/sync.ts#L731) and dedupes server-side with [`@@unique([sessionId, localId])`](https://github.com/slopus/happy/blob/e0170eac6494d12a5b95128f39bae2a823712bb6/packages/happy-server/prisma/schema.prisma#L159). Its agent receipts are [capability-gated](https://github.com/slopus/happy/blob/e0170eac6494d12a5b95128f39bae2a823712bb6/packages/happy-app/sources/sync/storageTypes.ts#L115), because a missing receipt would otherwise mean "Sending…" forever.
- **claudecodeui** rejects direct sends with [`RUN_IN_PROGRESS`](https://github.com/siteboon/claudecodeui/blob/c17c2f6d5f7e1e1d47fe37144ce0b2030002e331/server/modules/websocket/services/chat-websocket.service.ts#L237) and holds one queued turn. **CodexMonitor** treats the RPC response as the ack with a [300-second timeout](https://github.com/Dimillian/CodexMonitor/blob/dd61b9abd37de5ded86e82b9fe8a83fd49d46fa5/src-tauri/src/backend/app_server.rs#L432) and [falls back to its queue when a steer fails](https://github.com/Dimillian/CodexMonitor/blob/dd61b9abd37de5ded86e82b9fe8a83fd49d46fa5/src/features/threads/hooks/useQueuedSend.ts#L294).

## Common Patterns And Best Practices

- **Three outcomes, not two.** Accepted, rejected, and unknown (Orca, Zed, acpx, Codex TUI). Only provider or process evidence moves a message out of unknown.
- **Stable client IDs enforced by the receiver** make retries safe (OpenCode, Happy). Where the receiver gives no guarantee, as with Claude Code and Codex, no retry is safe.
- **Sequence cursors for replay**, with overlap deduped by sequence ([t3code](https://github.com/pingdotgg/t3code/blob/cb9629e6891ef0745772b69f09c9acd0c6a74f7e/apps/server/src/ws.ts#L904), [Orca](https://github.com/stablyai/orca/blob/b586ef9453acfc1332724c6c16f0f8f4a86d3875/src/main/native-chat/agent-session-journal/journal-cursor.ts#L26), [claudecodeui](https://github.com/siteboon/claudecodeui/blob/c17c2f6d5f7e1e1d47fe37144ce0b2030002e331/server/modules/websocket/services/chat-websocket.service.ts#L556)).
- **One writer per session**, with worktrees for parallel work. acpx is the join precedent: [prompts join the active session found from the git root](https://github.com/openclaw/acpx/blob/6ce38c34f4e5aef16bf28ca8b1fb1e6650695c60/docs/sessions.md#L58), and parallel work needs an explicit name. Orca enforces a [fail-closed single-writer lease](https://github.com/stablyai/orca/blob/b586ef9453acfc1332724c6c16f0f8f4a86d3875/src/shared/agent-session-lease-adjudication.ts#L3).
- **Harden steering around approvals.** claude-agent-acp lowers priority so a steer cannot cancel the open request, and CodexMonitor [pauses its flush](https://github.com/Dimillian/CodexMonitor/blob/dd61b9abd37de5ded86e82b9fe8a83fd49d46fa5/src/features/threads/hooks/useQueuedSend.ts#L383). Orca [holds cards behind open questions](https://github.com/stablyai/orca/blob/b586ef9453acfc1332724c6c16f0f8f4a86d3875/src/shared/structured-agent-session-queued-cards.ts#L34).

## Disagreements Or Tensions

- **Steer or queue.** Most GUIs default to queueing until the turn ends, and steering is responsible for most of the listed bugs. Protocol direction goes the other way: ACP v2, OpenCode and the Codex TUI all treat mid-turn input as normal.
- **What interrupt does to queued input.** Claude Code keeps it (E7) and Codex discards it, so one Stop button has two meanings.
- **Which signal counts.** claude-agent-acp reports insertion at `started`, Orca settles on echo, and t3code at queue offer. For releasing a composer, receipt is enough; for saying the agent saw it, only pickup counts.
- **Timeouts.** Orca says never time. CodexMonitor allows 300 seconds. Anthropic itself [recommends a timeout on waiting](https://code.claude.com/docs/en/agent-sdk/typescript#user_message_uuids), because a `UserPromptSubmit` hook can drop a message at pickup. Time can reasonably change what the UI says, but it cannot settle delivery.

## Risks And Anti-patterns

- Reporting a timeout as failure, which invites a user-made duplicate ([Orca PR 9792](https://github.com/stablyai/orca/pull/9792)).
- Automatic resend, including with the same UUID, given E5 and E6.
- Reusing an optimistic row alongside the real echo ([CodexMonitor #400](https://github.com/Dimillian/CodexMonitor/issues/400)).
- Depending solely on `command_lifecycle`: it is internal and could change. Gate on `msg_lifecycle_v1`, and keep the echo path.
- Priority `now` steers: they can cancel running tools, per t3code's implementation, and [abort auto-compaction](https://github.com/pingdotgg/t3code/issues/25796).
- A `--resume` of a session whose process is alive ([interleaved transcripts](https://code.claude.com/docs/en/sessions)).
- A queue that overwrites its one slot, which loses messages silently ([claudecodeui #1587](https://github.com/siteboon/claudecodeui/issues/1587)).

## Final Recommendation

### Delivery

1. In `chatProcess.resolve`, deliver the pending `user:<uuid>` on `command_lifecycle` `queued` for that `command_uuid`, when `system/init` advertises `msg_lifecycle_v1`. On `refused`, `discarded` or `cancelled`, fail the send; those are definite.
2. Without lifecycle frames, a successful write that times out returns a distinct unconfirmed result. Keep the pending entry so a late echo can settle it, and release the socket's send worker at the timeout.
3. On Codex, send `clientUserMessageId`, treat the RPC response as queued, and settle on the matching userMessage item. Treat an RPC timeout as unconfirmed.
4. Change the browser's message state to `sending`, `queued`, `started`, `unconfirmed`, `failed`. Show Orca's wording for unconfirmed: check the conversation before retrying. Retry only on user action, and restore the draft only for definite failures.
5. Hidden-until-the-turn-ends logic is ruled out by E7. Use lifecycle state for the hot reload notice: hide while the request is `queued` or `started`, keyed by session and command ID so it survives reloads. devhost's journal replays raw native frames, so a reloaded page should be able to derive this state; confirm that lifecycle frames reach the journal before relying on it.

### Joining

1. If exactly one devhost-owned session runs in the project, join it and name it in the chat.
2. If several run, ask which one. Do not guess: the request changes shared dev configuration.
3. If none run, check for agents devhost did not start (see [Local Libraries](#local-libraries)). When one is working in the checkout, say so and let the user choose, because devhost cannot send it anything. Otherwise start a session.
4. Never attach to a process devhost did not start, and never `--resume` a live session.

### Local Libraries

`agent-watcher` discovers running Claude Code, Pi, Codex and OpenCode sessions and maps them to processes, which supplies the visibility step 3 needs. A probe of `watcher.Run` on 2026-10-30 reported this machine's sessions with harness, session ID, PID and working directory: Claude Code within 0.1 seconds and Codex between 0.7 and 4.8 seconds.

- `Run` is the wrong layer for a page action. With no saved cursors it read every running session's history: 75,346 events and 4.7 GB of cumulative allocation in 13 seconds. The `scanner` package does the same discovery one-shot: on the same machine, 98 ms for Claude Code and 238 ms for a cold Codex scan of 148 rollouts, allocating 17.4 MB and 69.6 MB. A public snapshot call over the existing `discover` logic is the missing API.
- A live process does not mean a working agent, but Claude Code records the difference. `~/.claude/sessions/<pid>.json` holds a `status` field, undocumented, that went `busy`, `waiting` during a pending approval, `busy`, then `idle` in a `claude -p` stream-json run. Interactive sessions also showed `shell`, whose meaning was not established. `scanner.SessionDescriptor` reads `Status`, but `agent-watcher` discards it. Headless sessions report `kind: interactive`, so `entrypoint: sdk-cli` is the field that separates them.
- Codex has no such file, so working state needs transcript analysis. Its process matching also counts the `node` wrapper and the native binary as two processes, which lets one agent claim two rollouts and can mark a finished rollout active.
- Each session devhost owns would be discovered too, so exclude them by session ID, which devhost already holds.
- `run_started` also fires per subagent, and `CWD` is a session directory, so match it against the checkout rather than comparing for equality.
- `agent-parser` drops everything needed to correlate delivery. In Claude Code 2.1.310 stream-json runs with persistence on, a sent UUID reached the transcript in three shapes: `user.uuid` for a normal turn; `user.uuid` of the last message plus `mergedSendUuids` for the others when queued messages merge; and no `user` record at all when a message is absorbed mid-turn, leaving `queue-operation` `remove` with `commandUuid` and `reason: absorbed_mid_turn`. `enqueue` and `dequeue` records carry no UUID, so the transcript can prove consumption but cannot prove that a message was queued. This matters only for recovery after a process exits; stdout lifecycle frames remain the live signal.
- `messagingSocketPath` in the same session file suggests a local channel to other Claude Code sessions. It was not tested, so step 3's statement that devhost cannot send to such an agent is unproven for Claude Code.

### Remaining Unknowns

- `discarded` and `refused` were not exercised, and `cancelled` was not observed. They come from an adapter comment.
- Experiments are single runs on one CLI version and model. Rerun them when upgrading past a CLI that changes the lifecycle capability.
- What happens to a `UserPromptSubmit`-dropped message's lifecycle frames is unknown.
- `--replay-user-messages` combined with `--resume`, specifically whether history is re-echoed, is unknown.
- Codex steer during a pending approval is inferred from source ([`request_command_approval`](https://github.com/openai/codex/blob/a795f961be68383738e56ac396742b3e8451696a/codex-rs/core/src/session/mod.rs#L3113)); no test exists upstream.
- The third-party issue search was rate limited, so the bug lists are partial.

## Sources Reviewed

Versions were read on 2026-10-30.

| ID | Source | Type | Version | Used for |
| --- | --- | --- | --- | --- |
| S1 | [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript) | Official docs | Current | Message priority, receipts, UUIDs |
| S2 | [Agent SDK types](https://unpkg.com/@anthropic-ai/claude-agent-sdk@0.3.314/sdk.d.ts) | Official package | 0.3.314 | Replay and interrupt contracts |
| S3 | [Agent SDK for Python](https://github.com/anthropics/claude-agent-sdk-python/tree/1ea8cb74ddcdadbfaa9b20dfa8268e18047851e7) | Primary source | 0.2.175 | Send behavior |
| S4 | [Claude Code changelog](https://github.com/anthropics/claude-code/blob/d4dfed4e1c578cfea8bd6e64873e4f5e5b7e36f0/CHANGELOG.md) | Official changelog | To 2.1.314 | Replay fixes |
| S5 | [openai/codex](https://github.com/openai/codex/tree/6aaac694803004a63c6f393d153c96d22521a6b9) | Primary source | rust-v0.164.0 | App-server, TUI |
| S6 | [Agent Client Protocol](https://github.com/agentclientprotocol/agent-client-protocol/tree/a965f1f14e06865bee5da58f009c789ab9f630e5) | Specification | Schema 1.14.0, v2 draft | Prompt lifecycle |
| S7 | [claude-agent-acp](https://github.com/agentclientprotocol/claude-agent-acp/tree/eb78afa8556b8fc4082495e48e3fd1762fb6a50f) | Primary source | 0.99.1 | Lifecycle frames |
| S8 | [Zed](https://github.com/zed-industries/zed/tree/14b7b0ef3764d62a85070c8b5ccea105a2ad3235) | Primary source | 1.28.0 | Submission states |
| S9 | [codex-acp](https://github.com/agentclientprotocol/codex-acp/tree/580d8b926b3350ae8a3c74d54da81df311601d85) | Primary source | 2.5.0 | Client ID acknowledgement |
| S10 | [Gemini CLI](https://github.com/google-gemini/gemini-cli/tree/6814e00d6b148c3a1d57244d5d7040f7c541009d) | Primary source | 0.67.0-nightly | Prompt abort |
| S11 | [OpenCode](https://github.com/anomalyco/opencode/tree/958f965d35ed44d32b018fd55b02a5357a7748fd) | Primary source | 2.2.4 | Idempotent admission |
| S12 | [acpx](https://github.com/openclaw/acpx/tree/6ce38c34f4e5aef16bf28ca8b1fb1e6650695c60) | Primary source | 0.21.1 | Unknown outcome, session joining |
| S13 | [Goose](https://github.com/block/goose/tree/6ec4e9a2abc0fdb13f8af2676ceaf848a1df716f) | Primary source | 1.57.0 | Steer compare-and-swap |
| S14 | [Orca](https://github.com/stablyai/orca/tree/b586ef9453acfc1332724c6c16f0f8f4a86d3875) | Primary source | HEAD | Evidence-settled delivery |
| S15 | [vibe-kanban](https://github.com/BloopAI/vibe-kanban/tree/7c3807084daad0d9d315064f60fa869de254f027), [t3code](https://github.com/pingdotgg/t3code/tree/cb9629e6891ef0745772b69f09c9acd0c6a74f7e), [Happy](https://github.com/slopus/happy/tree/e0170eac6494d12a5b95128f39bae2a823712bb6), [claudecodeui](https://github.com/siteboon/claudecodeui/tree/c17c2f6d5f7e1e1d47fe37144ce0b2030002e331), [CodexMonitor](https://github.com/Dimillian/CodexMonitor/tree/dd61b9abd37de5ded86e82b9fe8a83fd49d46fa5) | Primary source | HEAD | Comparison points |
| S16 | Local experiments E1 to E7 | Direct measurement | Claude Code 2.1.310 | Echo and lifecycle timing |
| S17 | `agent-watcher` and `agent-parser` (local Go libraries) | Primary source and direct measurement | Local checkouts, 2026-10-30 | Discovering agents devhost did not start |

Dropped as unmaintained or pivoted: Companion, Crystal, opcode. Paradev and emdash were not examined in depth. Videos and benchmarks were not used, because the question concerns protocol behavior that source code and direct measurement answer better.
