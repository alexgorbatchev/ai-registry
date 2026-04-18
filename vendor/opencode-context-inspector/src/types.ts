/**
 * Segment categories for the system prompt breakdown.
 */
export type SegmentCategory =
  | "agent"
  | "rules"
  | "skills"
  | "builtin_tools"
  | "mcp"
  | "custom_tools"
  | "unknown"

/**
 * A single identified segment from the system prompt.
 */
export interface Segment {
  /** Category of this segment */
  category: SegmentCategory
  /** Human-readable label (e.g., "MCP: github", "Agent (coder)") */
  label: string
  /** The raw text content of this segment */
  content: string
  /** Token count for this segment */
  tokens: number
}

/**
 * Aggregated budget breakdown entry for display.
 */
export interface BudgetEntry {
  /** Display label */
  label: string
  /** Token count */
  tokens: number
  /** Percentage of total context window */
  percentage: number
}

/**
 * Complete budget snapshot at a point in time.
 */
export interface BudgetSnapshot {
  /** Model identifier */
  model: string
  /** Total context window size in tokens */
  contextWindow: number
  /** Individual budget entries */
  entries: BudgetEntry[]
  /** Total system prompt tokens */
  systemPromptTotal: number
  /** Estimated conversation tokens so far */
  conversationTokens: number
  /** Remaining available tokens */
  availableTokens: number
}

/**
 * Record of a single MCP tool call response cost.
 */
export interface ToolCallRecord {
  /** Server prefix (e.g., "github") */
  server: string
  /** Full tool name */
  toolName: string
  /** Token cost of the response */
  responseTokens: number
  /** Timestamp of the call */
  timestamp: number
}

/**
 * Cumulative session-level statistics.
 */
export interface SessionStats {
  /** Number of messages sent in the session */
  messageCount: number
  /** Running total of estimated input tokens */
  totalInputTokens: number
  /** Running total of estimated output tokens */
  totalOutputTokens: number
  /** Session start timestamp */
  startTime: number
  /** Number of compactions detected */
  compactionCount: number
  /** MCP tool call history */
  toolCalls: ToolCallRecord[]
  /** Last known system prompt token count */
  lastSystemPromptTokens: number
  /** Last known conversation token count */
  lastConversationTokens: number
}

/**
 * Plugin configuration options.
 */
export interface PluginConfig {
  /** Override model identifier for context window lookup */
  model?: string
  /** Override context window size directly */
  contextWindow?: number
  /** Minimum log level */
  logLevel: "debug" | "info" | "warn" | "error"
  /** Show budget table on every message */
  logOnEveryMessage: boolean
  /** Show visual bar indicators in budget table */
  showBarChart: boolean
  /** Track token cost of MCP tool responses */
  trackToolCallResults: boolean
  /** Warn when context usage exceeds this fraction (0-1) */
  warnThreshold: number
  /** Critical alert when context usage exceeds this fraction (0-1) */
  criticalThreshold: number
  /** Custom regex patterns for segment identification */
  customSegmentPatterns: Record<string, string>
}

/**
 * Logging interface abstraction.
 */
export interface Logger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}
