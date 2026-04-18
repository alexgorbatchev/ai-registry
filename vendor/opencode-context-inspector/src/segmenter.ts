import type { Segment, SegmentCategory } from "./types.js"
import { countTokens } from "./tokenizer.js"

/**
 * Pattern definition for identifying segments in the system prompt.
 */
interface SegmentPattern {
  category: SegmentCategory
  label: string | ((match: RegExpMatchArray) => string)
  pattern: RegExp
}

/**
 * Built-in patterns for identifying known sections of the system prompt.
 * Order matters — earlier patterns take priority for overlapping content.
 */
const BUILTIN_PATTERNS: SegmentPattern[] = [
  // MCP tool definitions — JSON schema blocks with server-prefixed tool names
  {
    category: "mcp",
    label: (match: RegExpMatchArray) => {
      const prefix = match[1] || "unknown"
      return `MCP: ${prefix}`
    },
    pattern:
      /(?:^|\n)(?:#+\s*)?(?:Tools?\s+(?:from|for|provided by)\s+)?(\w+)[\s\S]*?(?:\{[\s\S]*?"(?:name|function)":\s*"\1_\w+"[\s\S]*?\})/gm,
  },
  // MCP tool blocks — simpler pattern for "server_tool" naming convention
  {
    category: "mcp",
    label: (match: RegExpMatchArray) => `MCP: ${match[1] || "unknown"}`,
    pattern:
      /(?:^|\n)#+\s*(\w+)\s+(?:tools?|server)\b[\s\S]*?(?=\n#+\s|\n---|\n\*\*\*|$)/gim,
  },
  // Agent instructions — typically the core system prompt section
  {
    category: "agent",
    label: "Agent",
    pattern:
      /(?:^|\n)(?:You are |# (?:System|Agent|Assistant)\b)[\s\S]*?(?=\n#+\s*(?:Tools|MCP|Skills|Rules|Instructions)|\n---|\n\*\*\*|$)/gim,
  },
  // Skills — loaded from .opencode/skills/
  {
    category: "skills",
    label: "Skills",
    pattern:
      /(?:^|\n)(?:#+\s*)?(?:Skills?|<skill|Loaded skills?)[\s\S]*?(?=\n#+\s|\n---|\n\*\*\*|$)/gim,
  },
  // Rules and instructions — from AGENTS.md, instruction files
  {
    category: "rules",
    label: "Rules/Instructions",
    pattern:
      /(?:^|\n)(?:#+\s*)?(?:Rules?|Instructions?|Guidelines?|AGENTS\.md|Custom (?:rules|instructions))[\s\S]*?(?=\n#+\s|\n---|\n\*\*\*|$)/gim,
  },
  // Built-in tools — OpenCode native tools (bash, edit, glob, grep, etc.)
  {
    category: "builtin_tools",
    label: "Built-in tools",
    pattern:
      /(?:^|\n)(?:#+\s*)?(?:Built-?in tools?|Available tools?|Native tools?)[\s\S]*?(?:(?:bash|edit|glob|grep|read|write|ls|find)[\s\S]*?)(?=\n#+\s|\n---|\n\*\*\*|$)/gim,
  },
  // Custom tools — plugin-defined tools
  {
    category: "custom_tools",
    label: "Custom tools",
    pattern:
      /(?:^|\n)(?:#+\s*)?(?:Custom tools?|Plugin tools?|User tools?)[\s\S]*?(?=\n#+\s|\n---|\n\*\*\*|$)/gim,
  },
]

/**
 * Segment the system prompt into identified sections with token counts.
 *
 * Strategy:
 * 1. Apply custom user patterns first (highest priority)
 * 2. Apply built-in patterns
 * 3. Any unmatched content goes into "unknown"
 *
 * This is best-effort — the "unknown" bucket may be large initially.
 */
export function segmentSystemPrompt(
  systemPrompt: string,
  customPatterns?: Record<string, string>,
): Segment[] {
  if (!systemPrompt) return []

  const segments: Segment[] = []
  // Track which character ranges have been claimed
  const claimed = new Set<number>()

  // Apply custom patterns first
  if (customPatterns) {
    for (const [label, patternStr] of Object.entries(customPatterns)) {
      try {
        const regex = new RegExp(patternStr, "gim")
        let match: RegExpExecArray | null
        while ((match = regex.exec(systemPrompt)) !== null) {
          const content = match[0]
          const start = match.index
          // Check if this region is already claimed
          let alreadyClaimed = false
          for (let i = start; i < start + content.length; i++) {
            if (claimed.has(i)) {
              alreadyClaimed = true
              break
            }
          }
          if (alreadyClaimed) continue

          for (let i = start; i < start + content.length; i++) {
            claimed.add(i)
          }
          segments.push({
            category: "unknown",
            label,
            content,
            tokens: countTokens(content),
          })
        }
      } catch {
        // Invalid regex from user — skip silently
      }
    }
  }

  // Apply built-in patterns
  for (const patternDef of BUILTIN_PATTERNS) {
    // Reset regex lastIndex
    patternDef.pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = patternDef.pattern.exec(systemPrompt)) !== null) {
      const content = match[0]
      const start = match.index

      // Check if majority of this region is already claimed
      let claimedChars = 0
      for (let i = start; i < start + content.length; i++) {
        if (claimed.has(i)) claimedChars++
      }
      // Skip if more than 50% is already claimed
      if (claimedChars > content.length * 0.5) continue

      // Claim unclaimed characters
      for (let i = start; i < start + content.length; i++) {
        claimed.add(i)
      }

      const label =
        typeof patternDef.label === "function"
          ? patternDef.label(match)
          : patternDef.label

      segments.push({
        category: patternDef.category,
        label,
        content,
        tokens: countTokens(content),
      })
    }
  }

  // Collect unclaimed content as "unknown"
  const unclaimedParts: string[] = []
  let currentPart = ""
  for (let i = 0; i < systemPrompt.length; i++) {
    if (!claimed.has(i)) {
      currentPart += systemPrompt[i]
    } else if (currentPart.length > 0) {
      unclaimedParts.push(currentPart)
      currentPart = ""
    }
  }
  if (currentPart.length > 0) {
    unclaimedParts.push(currentPart)
  }

  const unknownContent = unclaimedParts.join("").trim()
  if (unknownContent.length > 0) {
    segments.push({
      category: "unknown",
      label: "Unknown",
      content: unknownContent,
      tokens: countTokens(unknownContent),
    })
  }

  return segments
}

/**
 * Merge segments with the same label (e.g., multiple MCP: github blocks).
 */
export function mergeSegments(segments: Segment[]): Segment[] {
  const merged = new Map<string, Segment>()

  for (const segment of segments) {
    const existing = merged.get(segment.label)
    if (existing) {
      existing.content += "\n" + segment.content
      existing.tokens += segment.tokens
    } else {
      merged.set(segment.label, { ...segment })
    }
  }

  return Array.from(merged.values())
}

/**
 * Extract MCP server prefix from a tool name (e.g., "github_list_repos" -> "github").
 */
export function extractServerPrefix(toolName: string): string {
  const underscoreIndex = toolName.indexOf("_")
  if (underscoreIndex > 0) {
    return toolName.substring(0, underscoreIndex)
  }
  return toolName
}
