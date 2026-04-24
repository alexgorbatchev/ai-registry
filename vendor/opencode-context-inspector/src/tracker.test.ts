import { describe, expect, it } from "vitest"
import { getSessionIdFromMessages, SessionTracker } from "./tracker.js"
import { countTokensMultiple } from "./tokenizer.js"

const defaultConfig = {
  logLevel: "info" as const,
  logOnEveryMessage: false,
  showBarChart: false,
  trackToolCallResults: true,
  warnThreshold: 0.8,
  criticalThreshold: 0.9,
  customSegmentPatterns: {},
}

describe("SessionTracker", () => {
  it("estimates conversation tokens from the full retained session", () => {
    const tracker = new SessionTracker(defaultConfig, "claude-sonnet-4-5", 200_000)

    tracker.updateConversationTokensFromMessages([
      {
        info: {
          role: "user",
          sessionID: "session-1",
        },
        parts: [{ type: "text", text: "First question" }],
      },
      {
        info: {
          role: "assistant",
          sessionID: "session-1",
        },
        parts: [
          {
            type: "tool",
            state: {
              status: "completed",
              input: { topic: "context" },
              output: "Tool answer",
              title: "context tool",
              time: {},
            },
          },
          { type: "text", text: "Final answer" },
        ],
      },
      {
        info: {
          role: "user",
          sessionID: "session-1",
        },
        parts: [{ type: "compaction" }, { type: "subtask" }],
      },
    ])

    expect(tracker.getStats().lastConversationTokens).toBe(
      countTokensMultiple([
        "First question",
        JSON.stringify({ topic: "context" }),
        "Tool answer",
        "Final answer",
        "What did we do so far?",
        "The following tool was executed by the user",
      ]),
    )
  })

  it("tracks current user input separately for idle summaries", () => {
    const tracker = new SessionTracker(defaultConfig, "claude-sonnet-4-5", 200_000)

    tracker.recordInputMessage([{ type: "text", text: "How much context is left?" }])
    tracker.recordInputMessage([{ type: "text", text: "Summarize the session too." }])

    expect(tracker.getStats().totalInputTokens).toBe(
      countTokensMultiple(["How much context is left?", "Summarize the session too."]),
    )
  })

  it("reads the active session ID from retained messages", () => {
    expect(
      getSessionIdFromMessages([
        {
          info: { role: "user", sessionID: "session-123" },
          parts: [{ type: "text", text: "hello" }],
        },
      ]),
    ).toBe("session-123")
  })

  it("builds fresh snapshots from the current retained conversation stats", () => {
    const tracker = new SessionTracker(defaultConfig, "claude-sonnet-4-5", 200_000)

    tracker.updateConversationTokensFromMessages([
      {
        info: { role: "user", sessionID: "session-1" },
        parts: [{ type: "text", text: "Previously discussed context usage" }],
      },
    ])
    tracker.processSystemPrompt(["System guidance", "Tool definitions"])

    expect(tracker.getBudgetSnapshot()?.conversationTokens).toBe(
      countTokensMultiple(["Previously discussed context usage"]),
    )
  })
})
