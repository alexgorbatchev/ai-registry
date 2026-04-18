import type { BudgetEntry, BudgetSnapshot, SessionStats, ToolCallRecord } from "./types.js"
import { formatContextWindow } from "./models.js"

const BAR_MAX_WIDTH = 5
const BAR_CHAR = "\u2588" // █

/**
 * Build a visual bar string proportional to the percentage value.
 */
function buildBar(percentage: number): string {
  const blocks = Math.round((percentage / 100) * BAR_MAX_WIDTH * 10)
  const fullBlocks = Math.floor(blocks / 10)
  return BAR_CHAR.repeat(Math.min(fullBlocks, BAR_MAX_WIDTH))
}

/**
 * Format a token count for display (e.g., 18200 -> "18,200").
 */
function formatTokenCount(tokens: number): string {
  return tokens.toLocaleString("en-US")
}

/**
 * Format a percentage for display (e.g., 0.091 -> "9.1%").
 */
function formatPercentage(fraction: number): string {
  return (fraction * 100).toFixed(1) + "%"
}

/**
 * Right-pad a string to a given width.
 */
function padRight(str: string, width: number): string {
  return str.length >= width ? str : str + " ".repeat(width - str.length)
}

/**
 * Left-pad a string to a given width.
 */
function padLeft(str: string, width: number): string {
  return str.length >= width ? str : " ".repeat(width - str.length) + str
}

/**
 * Format the per-message budget table.
 */
export function formatBudgetTable(snapshot: BudgetSnapshot, showBarChart: boolean): string {
  const header = `Context Budget -- ${snapshot.model} (${formatContextWindow(snapshot.contextWindow)})`
  const lines: string[] = []

  lines.push(header)
  lines.push("+--------------------------------------------------+")

  const labelWidth = 24
  const tokenWidth = 10
  const pctWidth = 6

  // Individual entries
  for (const entry of snapshot.entries) {
    const label = padRight(entry.label, labelWidth)
    const tokens = padLeft(formatTokenCount(entry.tokens) + " tk", tokenWidth)
    const pct = padLeft(formatPercentage(entry.percentage / 100), pctWidth)
    const bar = showBarChart ? "  " + buildBar(entry.percentage) : ""
    lines.push(`| ${label}${tokens}  ${pct}${bar}${" ".repeat(Math.max(0, 3 - (showBarChart ? buildBar(entry.percentage).length : 0)))}|`)
  }

  // Separator
  lines.push("| ------------------------------------------------ |")

  // System prompt total
  const sysLabel = padRight("System prompt total", labelWidth)
  const sysTokens = padLeft(formatTokenCount(snapshot.systemPromptTotal) + " tk", tokenWidth)
  const sysPct = padLeft(
    formatPercentage(snapshot.systemPromptTotal / snapshot.contextWindow),
    pctWidth,
  )
  lines.push(`| ${sysLabel}${sysTokens}  ${sysPct}   |`)

  // Conversation
  const convLabel = padRight("Conversation so far", labelWidth)
  const convTokens = padLeft(formatTokenCount(snapshot.conversationTokens) + " tk", tokenWidth)
  const convPct = padLeft(
    formatPercentage(snapshot.conversationTokens / snapshot.contextWindow),
    pctWidth,
  )
  lines.push(`| ${convLabel}${convTokens}  ${convPct}   |`)

  // Available
  const availLabel = padRight("Available", labelWidth)
  const availTokens = padLeft(formatTokenCount(snapshot.availableTokens) + " tk", tokenWidth)
  const availPct = padLeft(
    formatPercentage(snapshot.availableTokens / snapshot.contextWindow),
    pctWidth,
  )
  lines.push(`| ${availLabel}${availTokens}  ${availPct}   |`)

  lines.push("+--------------------------------------------------+")

  return lines.join("\n")
}

/**
 * Format the session summary displayed on session.idle.
 */
export function formatSessionSummary(stats: SessionStats, model: string): string {
  const lines: string[] = []
  const duration = Math.round((Date.now() - stats.startTime) / 60_000)

  lines.push("Session Summary")
  lines.push("-".repeat(37))
  lines.push(`Messages sent:              ${padLeft(String(stats.messageCount), 6)}`)
  lines.push(`Total input tokens:       ~${padLeft(formatTokenCount(stats.totalInputTokens), 6)}`)
  lines.push(`Total output tokens:      ~${padLeft(formatTokenCount(stats.totalOutputTokens), 6)}`)
  lines.push(`Session duration:           ${padLeft(duration + "min", 6)}`)
  lines.push(`Compactions:                ${padLeft(String(stats.compactionCount), 6)}`)

  // MCP tool call costs
  const serverCosts = aggregateToolCalls(stats.toolCalls)
  if (serverCosts.length > 0) {
    lines.push("")
    lines.push("MCP Tool Call Costs (responses):")
    for (const { server, callCount, totalTokens } of serverCosts) {
      lines.push(
        `  ${padRight(server, 10)} -- ${callCount} calls -- ~${formatTokenCount(totalTokens)} tk`,
      )
    }
  }

  // Top static consumers
  lines.push("")
  lines.push("Top context consumers (static, per message):")
  // This uses the last known snapshot entries, which would be passed in separately
  // For now we show the system prompt total
  lines.push(
    `  System prompt           ${padLeft(formatTokenCount(stats.lastSystemPromptTokens), 8)} tk`,
  )
  lines.push("-".repeat(37))

  return lines.join("\n")
}

/**
 * Aggregate tool call records by server prefix.
 */
function aggregateToolCalls(
  calls: ToolCallRecord[],
): Array<{ server: string; callCount: number; totalTokens: number }> {
  const byServer = new Map<string, { callCount: number; totalTokens: number }>()

  for (const call of calls) {
    const existing = byServer.get(call.server)
    if (existing) {
      existing.callCount++
      existing.totalTokens += call.responseTokens
    } else {
      byServer.set(call.server, { callCount: 1, totalTokens: call.responseTokens })
    }
  }

  return Array.from(byServer.entries())
    .map(([server, data]) => ({ server, ...data }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
}

/**
 * Format a threshold warning message.
 */
export function formatThresholdWarning(
  level: "warn" | "critical",
  usageFraction: number,
  topConsumer?: BudgetEntry,
): string {
  const pct = (usageFraction * 100).toFixed(0)

  if (level === "critical") {
    let msg = `CRITICAL: Context usage at ${pct}% -- session will compact soon.`
    if (topConsumer) {
      msg += `\n  Largest consumer: ${topConsumer.label} (${formatTokenCount(topConsumer.tokens)} tk)`
    }
    return msg
  }

  let msg = `WARNING: Context usage at ${pct}% -- approaching warn threshold.`
  msg += "\n  Consider disabling unused MCP servers to free up context."
  if (topConsumer) {
    msg += `\n  Largest consumer: ${topConsumer.label} (${formatTokenCount(topConsumer.tokens)} tk / ${topConsumer.percentage.toFixed(1)}%)`
  }
  return msg
}

/**
 * Format the context_budget tool response for inline display.
 */
export function formatBudgetToolResponse(snapshot: BudgetSnapshot): string {
  const lines: string[] = []
  lines.push(`Context Budget for ${snapshot.model} (${formatContextWindow(snapshot.contextWindow)} window):\n`)

  for (const entry of snapshot.entries) {
    lines.push(
      `- ${entry.label}: ${formatTokenCount(entry.tokens)} tokens (${entry.percentage.toFixed(1)}%)`,
    )
  }

  lines.push("")
  lines.push(
    `System prompt total: ${formatTokenCount(snapshot.systemPromptTotal)} tokens (${((snapshot.systemPromptTotal / snapshot.contextWindow) * 100).toFixed(1)}%)`,
  )
  lines.push(
    `Conversation so far: ${formatTokenCount(snapshot.conversationTokens)} tokens (${((snapshot.conversationTokens / snapshot.contextWindow) * 100).toFixed(1)}%)`,
  )
  lines.push(
    `Available: ${formatTokenCount(snapshot.availableTokens)} tokens (${((snapshot.availableTokens / snapshot.contextWindow) * 100).toFixed(1)}%)`,
  )

  return lines.join("\n")
}
