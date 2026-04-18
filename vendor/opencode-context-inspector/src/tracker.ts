import type {
  BudgetEntry,
  BudgetSnapshot,
  PluginConfig,
  Segment,
  SessionStats,
  ToolCallRecord,
} from "./types.js"
import { getContextWindow } from "./models.js"
import { countTokens } from "./tokenizer.js"
import { mergeSegments, segmentSystemPrompt } from "./segmenter.js"

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
   * Update conversation token estimate from message content.
   */
  updateConversationTokens(messageContent: string): void {
    const tokens = countTokens(messageContent)
    this.stats.lastConversationTokens = tokens
    this.stats.totalInputTokens += tokens
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
