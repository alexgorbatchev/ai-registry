import type {
  BudgetEntry,
  BudgetSnapshot,
  PluginConfig,
  Segment,
  SessionStats,
  ToolCallRecord,
} from "./types.js"
import { getContextWindow } from "./models.js"
import { countTokens, countTokensMultiple } from "./tokenizer.js"
import { mergeSegments, segmentSystemPrompt } from "./segmenter.js"

type RetainedToolState =
  | { status: "pending"; input: Record<string, unknown>; raw: string }
  | { status: "running"; input: Record<string, unknown>; title?: string }
  | {
      status: "completed"
      input: Record<string, unknown>
      output: string
      title: string
      time: { compacted?: number }
    }
  | {
      status: "error"
      input: Record<string, unknown>
      error: string
      metadata?: { interrupted?: boolean; output?: unknown }
    }

type RetainedMessagePart =
  | { type: "text"; text: string; ignored?: boolean; synthetic?: boolean }
  | { type: "reasoning"; text: string }
  | { type: "compaction" }
  | { type: "subtask" }
  | { type: "tool"; state: RetainedToolState }
  | { type: "file"; mime: string; filename?: string }
  | { type: "step-start" }
  | { type: "step-finish" }
  | { type: "snapshot" }
  | { type: "patch" }
  | { type: "agent" }
  | { type: "retry" }

type RetainedMessage = {
  info: {
    role: "user" | "assistant"
    sessionID?: string
  }
  parts: RetainedMessagePart[]
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value)
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value

  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return String(value)
  }
}

function extractRetainedPartTexts(role: RetainedMessage["info"]["role"], part: RetainedMessagePart): string[] {
  if (part.type === "text") {
    if (role === "user" && part.ignored) return []
    return part.text ? [part.text] : []
  }

  if (part.type === "reasoning") return [part.text]

  if (role === "user") {
    if (part.type === "compaction") return ["What did we do so far?"]
    if (part.type === "subtask") return ["The following tool was executed by the user"]
    if (part.type === "file" && part.mime !== "text/plain" && part.mime !== "application/x-directory") {
      return part.filename ? [`[Attached ${part.mime}: ${part.filename}]`] : [`[Attached ${part.mime}: file]`]
    }
    return []
  }

  if (part.type !== "tool") return []

  if (part.state.status === "completed") {
    return [
      stringifyUnknown(part.state.input),
      part.state.time.compacted ? "[Old tool result content cleared]" : part.state.output,
    ].filter(isNonEmptyString)
  }

  if (part.state.status === "error") {
    const interruptedOutput = typeof part.state.metadata?.output === "string" ? part.state.metadata.output : undefined
    return [stringifyUnknown(part.state.input), interruptedOutput ?? part.state.error].filter(isNonEmptyString)
  }

  return [stringifyUnknown(part.state.input), "[Tool execution was interrupted]"].filter(isNonEmptyString)
}

export function getSessionIdFromMessages(messages: RetainedMessage[]): string | undefined {
  return messages.find((message) => Boolean(message.info.sessionID))?.info.sessionID
}

/**
 * Session-level token usage tracker.
 * Maintains state across messages within a single session.
 */
export class SessionTracker {
  private stats: SessionStats
  private lastSegments: Segment[] = []
  private config: PluginConfig
  private model: string
  private contextWindow: number

  constructor(config: PluginConfig, model: string, modelContextWindow?: number) {
    this.config = config
    this.model = config.model || model || "default"
    // Priority: config override > model metadata from OpenCode > static lookup table
    this.contextWindow =
      config.contextWindow ||
      (modelContextWindow && modelContextWindow > 0 ? modelContextWindow : undefined) ||
      getContextWindow(this.model)
    this.stats = {
      messageCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      startTime: Date.now(),
      compactionCount: 0,
      toolCalls: [],
      lastSystemPromptTokens: 0,
      lastConversationTokens: 0,
    }
  }

  /**
   * Process a system prompt and return the budget snapshot.
   */
  processSystemPrompt(systemPromptParts: string[]): BudgetSnapshot {
    const fullPrompt = systemPromptParts.join("\n")
    const segments = segmentSystemPrompt(fullPrompt, this.config.customSegmentPatterns)
    const merged = mergeSegments(segments)
    this.lastSegments = merged

    const systemPromptTotal = merged.reduce((sum, s) => sum + s.tokens, 0)
    this.stats.lastSystemPromptTokens = systemPromptTotal
    this.stats.messageCount++

    // Build budget entries sorted by token count descending
    const entries: BudgetEntry[] = merged
      .map((s) => ({
        label: s.label,
        tokens: s.tokens,
        percentage: (s.tokens / this.contextWindow) * 100,
      }))
      .sort((a, b) => b.tokens - a.tokens)

    const conversationTokens = this.stats.lastConversationTokens
    const availableTokens = Math.max(
      0,
      this.contextWindow - systemPromptTotal - conversationTokens,
    )

    return {
      model: this.model,
      contextWindow: this.contextWindow,
      entries,
      systemPromptTotal,
      conversationTokens,
      availableTokens,
    }
  }

  /**
   * Get the latest snapshot using the current retained conversation estimate.
   */
  getBudgetSnapshot(): BudgetSnapshot | null {
    if (this.lastSegments.length === 0) return null

    const entries: BudgetEntry[] = this.lastSegments
      .map((segment) => ({
        label: segment.label,
        tokens: segment.tokens,
        percentage: (segment.tokens / this.contextWindow) * 100,
      }))
      .sort((a, b) => b.tokens - a.tokens)

    const systemPromptTotal = this.stats.lastSystemPromptTokens
    const conversationTokens = this.stats.lastConversationTokens

    return {
      model: this.model,
      contextWindow: this.contextWindow,
      entries,
      systemPromptTotal,
      conversationTokens,
      availableTokens: Math.max(0, this.contextWindow - systemPromptTotal - conversationTokens),
    }
  }

  /**
   * Record a tool call response and its token cost.
   */
  recordToolCall(toolName: string, server: string, responseText: string): void {
    const responseTokens = countTokens(responseText)
    const record: ToolCallRecord = {
      server,
      toolName,
      responseTokens,
      timestamp: Date.now(),
    }
    this.stats.toolCalls.push(record)
    this.stats.totalOutputTokens += responseTokens
  }

  /**
   * Update the retained conversation token estimate from the full message list.
   */
  updateConversationTokensFromMessages(messages: RetainedMessage[]): void {
    const texts = messages.flatMap((message) =>
      message.parts.flatMap((part) => extractRetainedPartTexts(message.info.role, part)),
    )
    this.stats.lastConversationTokens = countTokensMultiple(texts)
  }

  /**
   * Record the current user message for cumulative session input totals.
   */
  recordInputMessage(parts: RetainedMessagePart[]): void {
    this.stats.totalInputTokens += countTokensMultiple(
      parts.flatMap((part) => extractRetainedPartTexts("user", part)),
    )
  }

  /**
   * Record a compaction event.
   */
  recordCompaction(): void {
    this.stats.compactionCount++
  }

  /**
   * Get the current usage fraction (0-1) of the context window.
   */
  getUsageFraction(): number {
    const used = this.stats.lastSystemPromptTokens + this.stats.lastConversationTokens
    return used / this.contextWindow
  }

  /**
   * Get the top consumer entry from the last snapshot.
   */
  getTopConsumer(): BudgetEntry | undefined {
    if (this.lastSegments.length === 0) return undefined
    const sorted = [...this.lastSegments].sort((a, b) => b.tokens - a.tokens)
    const top = sorted[0]
    return {
      label: top.label,
      tokens: top.tokens,
      percentage: (top.tokens / this.contextWindow) * 100,
    }
  }

  /**
   * Get the full session statistics.
   */
  getStats(): SessionStats {
    return { ...this.stats }
  }

  /**
   * Get the model identifier.
   */
  getModel(): string {
    return this.model
  }
}

/**
 * Global tracker store, keyed by session ID.
 * Plugins don't have persistent state between sessions, so we track per-session.
 */
const trackers = new Map<string, SessionTracker>()

/**
 * Get or create a tracker for a session.
 */
export function getTracker(
  sessionId: string,
  config: PluginConfig,
  model: string,
  modelContextWindow?: number,
): SessionTracker {
  let tracker = trackers.get(sessionId)
  if (!tracker) {
    tracker = new SessionTracker(config, model, modelContextWindow)
    trackers.set(sessionId, tracker)
  }
  return tracker
}

/**
 * Get an existing tracker for a session without creating one.
 */
export function findTracker(sessionId: string): SessionTracker | undefined {
  return trackers.get(sessionId)
}

/**
 * Remove a tracker for a completed session.
 */
export function removeTracker(sessionId: string): void {
  trackers.delete(sessionId)
}

/**
 * Clear all trackers (useful for testing).
 */
export function clearTrackers(): void {
  trackers.clear()
}
