import type { PluginConfig } from "./types.js"

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const

const DEFAULTS: PluginConfig = {
  logLevel: "info",
  logOnEveryMessage: true,
  showBarChart: true,
  trackToolCallResults: true,
  warnThreshold: 0.7,
  criticalThreshold: 0.9,
  customSegmentPatterns: {},
}

/**
 * Parse and validate plugin configuration from user-provided options.
 * Unknown or invalid fields fall back to defaults.
 */
export function parseConfig(raw?: Record<string, unknown>): PluginConfig {
  if (!raw) return { ...DEFAULTS }

  const config: PluginConfig = { ...DEFAULTS }

  if (typeof raw.model === "string" && raw.model.length > 0) {
    config.model = raw.model
  }

  if (typeof raw.contextWindow === "number" && raw.contextWindow > 0) {
    config.contextWindow = raw.contextWindow
  }

  if (
    typeof raw.logLevel === "string" &&
    LOG_LEVELS.includes(raw.logLevel as PluginConfig["logLevel"])
  ) {
    config.logLevel = raw.logLevel as PluginConfig["logLevel"]
  }

  if (typeof raw.logOnEveryMessage === "boolean") {
    config.logOnEveryMessage = raw.logOnEveryMessage
  }

  if (typeof raw.showBarChart === "boolean") {
    config.showBarChart = raw.showBarChart
  }

  if (typeof raw.trackToolCallResults === "boolean") {
    config.trackToolCallResults = raw.trackToolCallResults
  }

  if (typeof raw.warnThreshold === "number" && raw.warnThreshold > 0 && raw.warnThreshold <= 1) {
    config.warnThreshold = raw.warnThreshold
  }

  if (
    typeof raw.criticalThreshold === "number" &&
    raw.criticalThreshold > 0 &&
    raw.criticalThreshold <= 1
  ) {
    config.criticalThreshold = raw.criticalThreshold
  }

  if (raw.customSegmentPatterns && typeof raw.customSegmentPatterns === "object") {
    const patterns: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw.customSegmentPatterns)) {
      if (typeof value === "string") {
        patterns[key] = value
      }
    }
    config.customSegmentPatterns = patterns
  }

  return config
}

/**
 * Check whether a log level should be emitted given the configured minimum.
 */
export function shouldLog(
  level: PluginConfig["logLevel"],
  minLevel: PluginConfig["logLevel"],
): boolean {
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(minLevel)
}
