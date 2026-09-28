import { describe, expect, it } from "bun:test";
import type {
  ContextEvent,
  CustomEntry,
  EntryRenderer,
  ExtensionAPI,
  ExtensionContext,
  SessionEntry,
  SessionStartEvent,
  TurnEndEvent,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

import timestamps, {
  CUSTOM_TYPE,
  DIM,
  RESET,
  _reset,
  formatLocalTimestamp,
  loadTimeZone,
  stripLegacyTimestamp,
} from "../timestamps";
import { join } from "node:path";

type EventHandler = (...args: unknown[]) => unknown;

function createMockExtensionApi(): {
  api: ExtensionAPI;
  handlers: Map<string, EventHandler>;
  appendedEntries: string[];
  registeredRenderers: Map<string, EntryRenderer>;
} {
  const handlers = new Map<string, EventHandler>();
  const appendedEntries: string[] = [];
  const registeredRenderers = new Map<string, EntryRenderer>();

  const api = {
    on: (event: string, handler: EventHandler) => {
      handlers.set(event, handler);
      return () => {
        handlers.delete(event);
      };
    },
    appendEntry: (customType: string) => {
      appendedEntries.push(customType);
    },
    registerEntryRenderer: (type: string, renderer: EntryRenderer) => {
      registeredRenderers.set(type, renderer);
    },
  } as unknown as ExtensionAPI;

  return { api, handlers, appendedEntries, registeredRenderers };
}

describe("formatLocalTimestamp", () => {
  it("formats timestamp in specified timezone with YYYY-MM-DD HH:mm:ss format", () => {
    // 2026-05-06T07:08:09.000Z
    const ts = Date.UTC(2026, 4, 6, 7, 8, 9);
    const resultUtc = formatLocalTimestamp(ts, "UTC");
    expect(resultUtc).toBe("2026-05-06 07:08:09");

    const resultNy = formatLocalTimestamp(ts, "America/New_York");
    expect(resultNy).toBe("2026-05-06 03:08:09");
  });

  it("formats midnight hour as 00", () => {
    const ts = Date.UTC(2026, 0, 1, 0, 0, 0);
    const result = formatLocalTimestamp(ts, "UTC");
    expect(result).toBe("2026-01-01 00:00:00");
  });

  it("formats default local timezone when no timezone passed", () => {
    const ts = Date.UTC(2026, 5, 15, 12, 0, 0);
    const result = formatLocalTimestamp(ts);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

describe("stripLegacyTimestamp", () => {
  it("strips legacy dim timestamp suffix from string content", () => {
    const input = `Hello world  ${DIM}2026-06-05T21:44:02Z${RESET}`;
    const result = stripLegacyTimestamp(input);
    expect(result).toBe("Hello world");
  });

  it("strips legacy dim timestamp suffix from text part array", () => {
    const input = [
      { type: "text" as const, text: "Hello" },
      { type: "text" as const, text: `  ${DIM}2026-06-05T21:44:02Z${RESET}` },
    ];
    const result = stripLegacyTimestamp(input);
    expect(result).toEqual([{ type: "text", text: "Hello" }]);
  });

  it("strips suffix from text part while retaining leading text in that part", () => {
    const input = [
      { type: "text" as const, text: `Greeting  ${DIM}2026-06-05T21:44:02Z${RESET}` },
    ];
    const result = stripLegacyTimestamp(input);
    expect(result).toEqual([{ type: "text", text: "Greeting" }]);
  });

  it("leaves content without timestamp unchanged", () => {
    const input = "Normal message";
    expect(stripLegacyTimestamp(input)).toBe("Normal message");
  });
});

describe("loadTimeZone", () => {
  it("returns undefined when file does not exist", () => {
    const result = loadTimeZone("/path/does/not/exist/timestamps.json");
    expect(result).toBeUndefined();
  });

  it("loads timezone from valid config file", async () => {
    const tempFile = join(process.cwd(), ".tmp", `test-tz-${Date.now()}.json`);
    await Bun.write(tempFile, JSON.stringify({ timeZone: "Europe/London" }));
    const result = loadTimeZone(tempFile);
    expect(result).toBe("Europe/London");
    await Bun.file(tempFile).delete();
  });

  it("handles invalid json gracefully", async () => {
    const tempFile = join(process.cwd(), ".tmp", `test-tz-invalid-${Date.now()}.json`);
    await Bun.write(tempFile, "not-valid-json");
    const result = loadTimeZone(tempFile);
    expect(result).toBeUndefined();
    await Bun.file(tempFile).delete();
  });

  it("returns undefined when timeZone is not a string", async () => {
    const tempFile = join(process.cwd(), ".tmp", `test-tz-empty-${Date.now()}.json`);
    await Bun.write(tempFile, JSON.stringify({ timeZone: 123 }));
    const result = loadTimeZone(tempFile);
    expect(result).toBeUndefined();
    await Bun.file(tempFile).delete();
  });
});

describe("timestamps extension", () => {
  it("registers lifecycle events and entry renderer", () => {
    _reset();
    const mock = createMockExtensionApi();
    timestamps(mock.api);

    expect(mock.handlers.has("session_start")).toBe(true);
    expect(mock.handlers.has("context")).toBe(true);
    expect(mock.handlers.has("turn_end")).toBe(true);
    expect(mock.registeredRenderers.has(CUSTOM_TYPE)).toBe(true);
  });

  it("appends custom entry on context when leaf is a user message", () => {
    _reset();
    const mock = createMockExtensionApi();
    timestamps(mock.api);

    const contextHandler = mock.handlers.get("context");
    const mockContext = {
      sessionManager: {
        getLeafEntry: () => ({
          type: "message",
          message: { role: "user", content: "hi", timestamp: 1000 },
        }),
      },
    } as unknown as ExtensionContext;

    contextHandler?.({ messages: [] } as unknown as ContextEvent, mockContext);
    expect(mock.appendedEntries).toEqual([CUSTOM_TYPE]);
  });

  it("does not append custom entry on context when leaf is not a user message", () => {
    _reset();
    const mock = createMockExtensionApi();
    timestamps(mock.api);

    const contextHandler = mock.handlers.get("context");
    const mockContext = {
      sessionManager: {
        getLeafEntry: () => ({
          type: "message",
          message: { role: "assistant", content: "ok", timestamp: 2000 },
        }),
      },
    } as unknown as ExtensionContext;

    contextHandler?.({ messages: [] } as unknown as ContextEvent, mockContext);
    expect(mock.appendedEntries).toEqual([]);
  });

  it("strips legacy stamps from messages during context event", () => {
    _reset();
    const mock = createMockExtensionApi();
    timestamps(mock.api);

    const contextHandler = mock.handlers.get("context");
    const mockContext = {
      sessionManager: {
        getLeafEntry: () => undefined,
      },
    } as unknown as ExtensionContext;

    const event = {
      messages: [
        { role: "user", content: `Question  ${DIM}2026-06-05T21:44:02Z${RESET}` },
        { role: "assistant", content: "Answer" },
      ],
    } as unknown as ContextEvent;

    const result = contextHandler?.(event, mockContext) as { messages: Array<{ role: string; content: string }> } | undefined;
    expect(result).toBeDefined();
    expect(result?.messages[0]?.content).toBe("Question");
  });

  it("returns undefined from context when no messages need legacy stripping", () => {
    _reset();
    const mock = createMockExtensionApi();
    timestamps(mock.api);

    const contextHandler = mock.handlers.get("context");
    const mockContext = {
      sessionManager: {
        getLeafEntry: () => undefined,
      },
    } as unknown as ExtensionContext;

    const event = {
      messages: [
        { role: "user", content: "Clean question" },
        { role: "assistant", content: "Clean answer" },
      ],
    } as unknown as ContextEvent;

    const result = contextHandler?.(event, mockContext);
    expect(result).toBeUndefined();
  });

  it("appends custom entry on turn_end", () => {
    _reset();
    const mock = createMockExtensionApi();
    timestamps(mock.api);

    const turnEndHandler = mock.handlers.get("turn_end");
    turnEndHandler?.({} as TurnEndEvent, {} as ExtensionContext);
    expect(mock.appendedEntries).toEqual([CUSTOM_TYPE]);
  });

  it("renders formatted local timestamp using parent message timestamp", () => {
    _reset();
    const mock = createMockExtensionApi();
    timestamps(mock.api);

    const sessionStartHandler = mock.handlers.get("session_start");
    const parentTimestamp = Date.UTC(2026, 8, 28, 14, 30, 0);

    const entriesMap = new Map<string, SessionEntry>([
      [
        "parent-1",
        {
          id: "parent-1",
          type: "message",
          message: { role: "assistant", content: "done", timestamp: parentTimestamp },
        } as unknown as SessionEntry,
      ],
    ]);

    sessionStartHandler?.(
      {} as SessionStartEvent,
      {
        sessionManager: {
          getEntry: (id: string) => entriesMap.get(id),
        },
      } as unknown as ExtensionContext,
    );

    const renderer = mock.registeredRenderers.get(CUSTOM_TYPE);
    const entry: CustomEntry = {
      id: "entry-1",
      parentId: "parent-1",
      type: "custom",
      customType: CUSTOM_TYPE,
      timestamp: new Date(parentTimestamp).toISOString(),
    };

    const renderResult = renderer?.(
      entry,
      {} as Parameters<EntryRenderer>[1],
      {} as Parameters<EntryRenderer>[2],
    );
    expect(renderResult instanceof Text).toBe(true);

    const expectedTime = formatLocalTimestamp(parentTimestamp);
    const renderedLines = (renderResult as Text).render(100);
    expect(renderedLines.some((line) => line.includes(expectedTime))).toBe(true);
  });

  it("falls back to entry timestamp when parent is missing", () => {
    _reset();
    const mock = createMockExtensionApi();
    timestamps(mock.api);

    const sessionStartHandler = mock.handlers.get("session_start");
    sessionStartHandler?.(
      {} as SessionStartEvent,
      {
        sessionManager: {
          getEntry: () => undefined,
        },
      } as unknown as ExtensionContext,
    );

    const renderer = mock.registeredRenderers.get(CUSTOM_TYPE);
    const entryTimestamp = Date.UTC(2026, 8, 28, 15, 0, 0);
    const entry: CustomEntry = {
      id: "entry-2",
      parentId: "missing-parent",
      type: "custom",
      customType: CUSTOM_TYPE,
      timestamp: new Date(entryTimestamp).toISOString(),
    };

    const renderResult = renderer?.(
      entry,
      {} as Parameters<EntryRenderer>[1],
      {} as Parameters<EntryRenderer>[2],
    );
    expect(renderResult instanceof Text).toBe(true);

    const expectedTime = formatLocalTimestamp(entryTimestamp);
    const renderedLines = (renderResult as Text).render(100);
    expect(renderedLines.some((line) => line.includes(expectedTime))).toBe(true);
  });

  it("returns undefined when entry timestamp is invalid", () => {
    _reset();
    const mock = createMockExtensionApi();
    timestamps(mock.api);

    const renderer = mock.registeredRenderers.get(CUSTOM_TYPE);
    const entry: CustomEntry = {
      id: "entry-3",
      parentId: null,
      type: "custom",
      customType: CUSTOM_TYPE,
      timestamp: "not-a-valid-date",
    };

    const renderResult = renderer?.(
      entry,
      {} as Parameters<EntryRenderer>[1],
      {} as Parameters<EntryRenderer>[2],
    );
    expect(renderResult).toBeUndefined();
  });
});
