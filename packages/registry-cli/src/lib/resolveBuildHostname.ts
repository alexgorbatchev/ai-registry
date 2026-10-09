export function resolveBuildHostname(override: string | undefined, detectedHostname: string): string {
  const hostname = override ?? detectedHostname;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(hostname)) {
    throw new Error("Invalid build hostname: use a non-empty hostname containing letters, digits, dots, underscores, or hyphens.");
  }
  return hostname;
}
