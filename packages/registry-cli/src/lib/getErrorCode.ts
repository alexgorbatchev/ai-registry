// Reads the `code` a Node.js system error carries, such as ENOENT.
export function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  const { code } = error;
  return typeof code === "string" ? code : null;
}
