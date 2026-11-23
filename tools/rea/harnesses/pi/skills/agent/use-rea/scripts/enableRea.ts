import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function enableRea(pi: ExtensionAPI): void {
  if (!("registerMcpServer" in pi) || typeof pi.registerMcpServer !== "function") {
    throw new Error("REA session activation requires Pi with registerMcpServer support (Pi 1.6 or newer).");
  }

  pi.registerMcpServer("rea-session", {
    command: "bun",
    args: ["x", "rea-agents@6.10.1", "mcp"],
    timeout: 450,
  });
}
