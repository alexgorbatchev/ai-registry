export function parseSizeToBytes(rawInput: string): number {
  const trimmed = rawInput.trim();
  const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)$/);
  if (!match) {
    throw new Error(`Invalid size specification: "${rawInput}". Examples: 1, 1.5, 500M, 2GB`);
  }

  const numericValue = parseFloat(match[1] ?? '0');
  if (Number.isNaN(numericValue) || numericValue <= 0) {
    throw new Error(`Size must be a positive number: "${rawInput}"`);
  }

  const rawUnit = (match[2] ?? '').toUpperCase();
  switch (rawUnit) {
    case '':
    case 'G':
    case 'GB':
      return Math.round(numericValue * 1024 * 1024 * 1024);
    case 'M':
    case 'MB':
      return Math.round(numericValue * 1024 * 1024);
    case 'K':
    case 'KB':
      return Math.round(numericValue * 1024);
    case 'T':
    case 'TB':
      return Math.round(numericValue * 1024 * 1024 * 1024 * 1024);
    case 'B':
      return Math.round(numericValue);
    default:
      throw new Error(`Unknown size unit: "${rawUnit}". Supported units: B, K, M, G, T`);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
  }
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}
