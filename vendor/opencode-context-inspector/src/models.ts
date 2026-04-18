/**
 * Known model context window sizes in tokens.
 */
const CONTEXT_WINDOWS: Record<string, number> = {
  // Anthropic
  "claude-opus-4-6": 1_000_000,
  "claude-opus-4-5": 200_000,
  "claude-sonnet-4-5": 200_000,
  "claude-sonnet-4-0": 200_000,
  "claude-haiku-4-5": 200_000,
  "claude-haiku-3-5": 200_000,
  // OpenAI
  "gpt-5.2": 400_000,
  "gpt-5.1": 400_000,
  "gpt-5-mini": 400_000,
  "gpt-5": 400_000,
  "gpt-4o": 128_000,
  "gpt-4.1": 1_000_000,
  "gpt-4.1-mini": 1_000_000,
  "gpt-4.1-nano": 1_000_000,
  "o3": 200_000,
  "o4-mini": 128_000,
  // Google
  "gemini-2.5-pro": 1_000_000,
  "gemini-2.5-flash": 1_000_000,
  "gemini-3-pro": 1_000_000,
  // xAI
  "grok-4": 256_000,
  "grok-4-fast": 2_000_000,
  "grok-4.1-fast": 2_000_000,
  // Meta Llama
  "llama-4-scout": 10_000_000,
  "llama-4-maverick": 1_000_000,
  // DeepSeek
  "deepseek-r1": 128_000,
  "deepseek-v3": 128_000,
  "deepseek-chat": 128_000,
  "deepseek-reasoner": 128_000,
  // Default fallback
  default: 128_000,
}

/**
 * Look up the context window size for a model.
 * Tries exact match first, then prefix match, then falls back to default.
 */
export function getContextWindow(model: string): number {
  // Exact match
  if (model in CONTEXT_WINDOWS) {
    return CONTEXT_WINDOWS[model]
  }

  // Prefix match — handle versioned model strings like "claude-sonnet-4-5-20250514"
  for (const [key, value] of Object.entries(CONTEXT_WINDOWS)) {
    if (key !== "default" && model.startsWith(key)) {
      return value
    }
  }

  return CONTEXT_WINDOWS["default"]
}

/**
 * Format a context window size for display (e.g., 200000 -> "200K").
 */
export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`
  }
  const k = tokens / 1_000
  return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`
}
