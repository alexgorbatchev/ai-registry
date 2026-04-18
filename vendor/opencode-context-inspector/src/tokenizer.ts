import { encoding_for_model } from "tiktoken"

let encoder: ReturnType<typeof encoding_for_model> | null = null

/**
 * Get or create the cached tiktoken encoder instance.
 * Uses cl100k_base via gpt-4o model — close enough for budget analysis across providers.
 */
function getEncoder(): ReturnType<typeof encoding_for_model> {
  if (!encoder) {
    encoder = encoding_for_model("gpt-4o")
  }
  return encoder
}

/**
 * Count tokens in a string using tiktoken cl100k_base encoding.
 * Returns 0 for empty or invalid input.
 */
export function countTokens(text: string): number {
  if (!text) return 0

  try {
    const enc = getEncoder()
    const tokens = enc.encode(text)
    return tokens.length
  } catch {
    // Fallback: rough estimate of ~4 chars per token
    return Math.ceil(text.length / 4)
  }
}

/**
 * Count tokens for an array of strings, returning the total.
 */
export function countTokensMultiple(texts: string[]): number {
  let total = 0
  for (const text of texts) {
    total += countTokens(text)
  }
  return total
}

/**
 * Free the cached encoder to release memory.
 * Useful for cleanup in tests or when the plugin is unloaded.
 */
export function freeEncoder(): void {
  if (encoder) {
    encoder.free()
    encoder = null
  }
}
