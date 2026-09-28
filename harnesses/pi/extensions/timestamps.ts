import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { Message } from "@earendil-works/pi-ai";
import type {
  ContextEvent,
  EntryRenderer,
  ExtensionAPI,
  ExtensionContext,
  SessionEntry,
  SessionStartEvent,
  TurnEndEvent,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

export const DIM = "\x1b[2m";
export const RESET = "\x1b[0m";

export const CUSTOM_TYPE = "pi-timestamps";

interface IReadonlySessionManager {
  getEntry(id: string): SessionEntry | undefined;
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const LEGACY_STAMP_REGEX = new RegExp(
  `\\s*${escapeRegex(DIM)}\\d{4}-\\d{2}-\\d{2}(?:T|\\s)\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?(?:Z|[+-]\\d{2}:?\\d{2})?${escapeRegex(RESET)}$`,
);

export function stripLegacyTimestamp(content: string): string;
export function stripLegacyTimestamp<T extends Message["content"]>(content: T): T;
export function stripLegacyTimestamp<T extends Message["content"]>(content: T): T {
  if (typeof content === "string") {
    return content.replace(LEGACY_STAMP_REGEX, "") as T;
  }
  if (Array.isArray(content) && content.length > 0) {
    const last = content[content.length - 1];
    if (last && last.type === "text" && LEGACY_STAMP_REGEX.test(last.text)) {
      const rest = last.text.replace(LEGACY_STAMP_REGEX, "");
      if (rest.trim() === "") {
        return content.slice(0, -1) as unknown as T;
      }
      return [...content.slice(0, -1), { ...last, text: rest }] as unknown as T;
    }
  }
  return content;
}

export function loadTimeZone(
  configPath: string = join(homedir(), ".pi", "agent", "timestamps.json"),
): string | undefined {
  try {
    if (existsSync(configPath)) {
      const parsed: unknown = JSON.parse(readFileSync(configPath, "utf-8"));
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "timeZone" in parsed &&
        typeof parsed.timeZone === "string" &&
        parsed.timeZone.trim().length > 0
      ) {
        return parsed.timeZone.trim();
      }
    }
  } catch {
    // Ignore invalid or unreadable config
  }
  return undefined;
}

export function formatLocalTimestamp(ts: number, timeZone?: string): string {
  const date = new Date(ts);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  };
  if (timeZone) {
    options.timeZone = timeZone;
  }
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

let sessionManager: IReadonlySessionManager | undefined;

export function _reset(): void {
  sessionManager = undefined;
}

export default function timestamps(pi: ExtensionAPI): void {
  pi.on("session_start", (_event: SessionStartEvent, ctx: ExtensionContext) => {
    sessionManager = ctx.sessionManager;
  });

  pi.on("context", (event: ContextEvent, ctx: ExtensionContext) => {
    const leaf = ctx.sessionManager.getLeafEntry();
    if (leaf?.type === "message" && leaf.message.role === "user") {
      pi.appendEntry(CUSTOM_TYPE);
    }

    let changed = false;
    const messages = event.messages.map((m) => {
      if ((m.role === "user" || m.role === "assistant") && m.content != null) {
        const content = stripLegacyTimestamp(m.content);
        if (content !== m.content) {
          changed = true;
          return { ...m, content } as typeof m;
        }
      }
      return m;
    });
    return changed ? { messages } : undefined;
  });

  pi.on("turn_end", (_event: TurnEndEvent, _ctx: ExtensionContext) => {
    pi.appendEntry(CUSTOM_TYPE);
  });

  const timeZone = loadTimeZone();
  const renderer: EntryRenderer = (entry) => {
    const parent = entry.parentId ? sessionManager?.getEntry(entry.parentId) : undefined;
    let ts: number | undefined = parent?.type === "message" ? parent.message.timestamp : undefined;
    if (typeof ts !== "number") {
      ts = Date.parse(entry.timestamp);
    }
    if (Number.isNaN(ts)) {
      return undefined;
    }
    return new Text(`${DIM}${formatLocalTimestamp(ts, timeZone)}${RESET}`, 1, 0);
  };
  pi.registerEntryRenderer(CUSTOM_TYPE, renderer);
}
