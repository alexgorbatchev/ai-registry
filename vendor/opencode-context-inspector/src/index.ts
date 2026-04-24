import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { parseConfig, shouldLog } from "./config.js"
import {
  formatBudgetTable,
  formatBudgetToolResponse,
  formatSessionSummary,
  formatThresholdWarning,
} from "./formatter.js"
import { findTracker, getSessionIdFromMessages, getTracker, removeTracker } from "./tracker.js"
import { extractServerPrefix } from "./segmenter.js"
import { countTokens } from "./tokenizer.js"
import type { Logger, PluginConfig } from "./types.js"

/**
 * opencode-context-inspector plugin.
 *
 * Provides full visibility into how the context window budget is consumed
 * by MCP servers, agents, skills, rules, custom tools, and conversation history.
 */
const plugin: Plugin = async ({ client }) => {
  const config = parseConfig()
  const defaultModel = config.model || "default"

  /**
   * Create a logger that respects the configured log level.
   */
  function createLogger(): Logger {
    const log = (level: PluginConfig["logLevel"], message: string) => {
      if (!shouldLog(level, config.logLevel)) return
      try {
        client.app.log({ body: { service: "context-inspector", level, message } })
      } catch {
        // Degrade gracefully if logging fails
      }
    }

    return {
      debug: (msg: string) => log("debug", msg),
      info: (msg: string) => log("info", msg),
      warn: (msg: string) => log("warn", msg),
      error: (msg: string) => log("error", msg),
    }
  }

  const logger = createLogger()

  return {
    /**
     * Capture the current user message so session summaries can report cumulative input cost.
     */
    "chat.message": async (input, output) => {
      try {
        const tracker = getTracker(input.sessionID, config, input.model?.modelID || defaultModel)
        tracker.recordInputMessage(output.parts)
      } catch (err) {
        logger.debug(
          `Error processing current message: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    },

    /**
     * Capture the full retained conversation before it is converted into model messages.
     * This gives us a much better estimate than only counting the latest message event.
     */
    "experimental.chat.messages.transform": async (_input, output) => {
      try {
        const sessionId = getSessionIdFromMessages(output.messages) || "current"
        const tracker = getTracker(sessionId, config, defaultModel)
        tracker.updateConversationTokensFromMessages(output.messages)
      } catch (err) {
        logger.debug(
          `Error processing retained messages: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    },

    /**
     * Core hook: fires before every message with the full assembled system prompt.
     * This is where all injected context lives: MCP tool schemas, agent instructions,
     * skills, rules, custom tool definitions, etc.
     */
    "experimental.chat.system.transform": async (input, output) => {
      try {
        // output.system contains the system prompt parts
        const systemParts: string[] = []
        if (Array.isArray(output.system)) {
          for (const part of output.system) {
            if (typeof part === "string") {
              systemParts.push(part)
            } else if (part && typeof part === "object" && "text" in part) {
              systemParts.push(String((part as { text: unknown }).text))
            }
          }
        }

        if (systemParts.length === 0) {
          logger.debug("No system prompt content found")
          return
        }

        // Use session ID and model from hook input when available
        const sessionId = input.sessionID || "current"
        const modelId = input.model?.id || defaultModel
        // Prefer the context limit from the model metadata (model.limit.context)
        // over our static lookup table — this is the real value from OpenCode
        const modelContextWindow = input.model?.limit?.context
        const tracker = getTracker(sessionId, config, modelId, modelContextWindow)
        const snapshot = tracker.processSystemPrompt(systemParts)

        // Log budget table if configured
        if (config.logOnEveryMessage) {
          const table = formatBudgetTable(snapshot, config.showBarChart)
          logger.info(table)
        }

        // Check thresholds
        const usageFraction = tracker.getUsageFraction()
        if (usageFraction >= config.criticalThreshold) {
          const topConsumer = tracker.getTopConsumer()
          logger.error(formatThresholdWarning("critical", usageFraction, topConsumer))
        } else if (usageFraction >= config.warnThreshold) {
          const topConsumer = tracker.getTopConsumer()
          logger.warn(formatThresholdWarning("warn", usageFraction, topConsumer))
        }
      } catch (err) {
        logger.error(
          `Error processing system prompt: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    },

    /**
     * Track token cost of tool call responses (the dynamic cost on top of
     * the static definition cost in the system prompt).
     */
    "tool.execute.after": async (input, output) => {
      if (!config.trackToolCallResults) return

      try {
        const toolName = input?.tool
        if (!toolName || typeof toolName !== "string") return

        const responseText =
          typeof output?.output === "string"
            ? output.output
            : JSON.stringify(output?.output ?? "")

        const server = extractServerPrefix(toolName)
        const sessionId = input.sessionID || "current"
        const tracker = getTracker(sessionId, config, defaultModel)
        tracker.recordToolCall(toolName, server, responseText)

        const responseTokens = countTokens(responseText)
        logger.debug(
          `Tool ${toolName} response: ~${responseTokens.toLocaleString()} tokens`,
        )
      } catch (err) {
        logger.debug(
          `Error tracking tool call: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    },

    /**
     * Subscribe to system events for session summaries and message tracking.
     */
    event: async ({ event }) => {
      try {
        if (event.type === "session.idle") {
          const tracker = getTracker(event.properties.sessionID, config, defaultModel)
          const stats = tracker.getStats()

          if (stats.messageCount > 0) {
            const summary = formatSessionSummary(stats, tracker.getModel())
            logger.info(summary)
          }
        }

        if (event.type === "session.compacted") {
          const tracker = getTracker(event.properties.sessionID, config, defaultModel)
          tracker.recordCompaction()
          logger.info("Session compacted — context window was full")
        }

        if (event.type === "session.deleted") {
          removeTracker(event.properties.info.id)
        }
      } catch (err) {
        logger.debug(
          `Error handling event: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    },

    /**
     * Custom tool: context_budget
     * Allows the LLM to report the current budget breakdown inline in conversation.
     * Users can ask "how's my context budget looking?" and get a direct answer.
     */
    tool: {
      context_budget: tool({
        description:
          "Report the current context window budget breakdown showing how much of the context is consumed by MCP servers, agents, skills, rules, tools, and conversation history. Use this when the user asks about context usage, token budget, or context window consumption.",
        args: {
          format: tool.schema
            .enum(["table", "summary"])
            .optional()
            .describe("Output format: 'table' for detailed breakdown, 'summary' for brief overview"),
        },
        async execute(_args, context) {
          const snapshot = findTracker(context.sessionID)?.getBudgetSnapshot()
          if (!snapshot) {
            return "No context budget data available yet. The budget is analyzed on each message — try asking again after your next message."
          }
          return formatBudgetToolResponse(snapshot)
        },
      }),
    },
  }
}

export default plugin
