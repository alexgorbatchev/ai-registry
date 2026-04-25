#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

interface IExtractedMessage {
  session_id: string;
  session_title: string;
  timestamp: number;
  text: string;
}

interface ITableNameRow {
  name: string;
}

interface ISessionCountRow {
  session_count: number;
}

interface IMessagePartRow {
  session_id: string;
  session_title: string;
  message_id: string;
  message_time: number;
  part_text: string | null;
}

interface IExtractArguments {
  dbPath: string;
  outputDirectory: string;
  storageDirectory: string;
}

const DEFAULT_DATA_DIR = join(process.env.XDG_DATA_HOME ?? join(process.env.HOME ?? "", ".local", "share"), "opencode");
const DEFAULT_DB_PATH = join(DEFAULT_DATA_DIR, "opencode.db");
const DEFAULT_STORAGE_DIR = join(DEFAULT_DATA_DIR, "storage");
const REPO_ROOT_PLACEHOLDER = "{{repo_root}}";
const RESOLVED_REPO_ROOT =
  REPO_ROOT_PLACEHOLDER === "{{repo_root}}"
    ? resolve(import.meta.dir, "..", "..", "..", "..", "..")
    : REPO_ROOT_PLACEHOLDER;
const DEFAULT_OUTPUT_DIR = join(RESOLVED_REPO_ROOT, ".opencode-analysis");
const COMMAND_NAME = process.env.OPENCODE_CONVERSATION_EXTRACT_COMMAND?.trim() || "bun scripts/extract.ts";
const CHUNK_SIZE = 320000;
const MIN_TEXT_LEN = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringProperty(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function flushRecord(
  records: IExtractedMessage[],
  sessionId: string | undefined,
  sessionTitle: string,
  timestamp: number,
  textParts: string[],
): void {
  if (!sessionId) {
    return;
  }

  const text = textParts.filter((part) => part.length > 0).join("\n");
  if (text.length < MIN_TEXT_LEN) {
    return;
  }

  records.push({
    session_id: sessionId,
    session_title: sessionTitle,
    timestamp,
    text,
  });
}

function printUsage(): void {
  console.log(
    `Usage: ${COMMAND_NAME} [--output-dir <path>] [--db <path-to-opencode.db>] [--storage-dir <path-to-storage-dir>]`,
  );
  console.log("- output-dir defaults to .opencode-analysis under the resolved repo root");
  console.log("- extracts user messages into all_messages.jsonl plus chunk_N.jsonl files");
  console.log("- falls back to the legacy storage directory when SQLite is unavailable");
}

function parseArguments(argv: string[]): IExtractArguments {
  let dbPath = DEFAULT_DB_PATH;
  let outputDirectory = DEFAULT_OUTPUT_DIR;
  let storageDirectory = DEFAULT_STORAGE_DIR;
  let hasStorageDirectoryOverride = false;

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      printUsage();
      process.exit(0);
    }

    if (argument === "--db") {
      const nextArgument = argv[index + 1];
      if (!nextArgument) {
        throw new Error("Missing value for --db");
      }

      dbPath = nextArgument;
      index += 1;
      continue;
    }

    if (argument === "--output-dir") {
      const nextArgument = argv[index + 1];
      if (!nextArgument) {
        throw new Error("Missing value for --output-dir");
      }

      outputDirectory = nextArgument;
      index += 1;
      continue;
    }

    if (argument === "--storage-dir") {
      const nextArgument = argv[index + 1];
      if (!nextArgument) {
        throw new Error("Missing value for --storage-dir");
      }

      storageDirectory = nextArgument;
      hasStorageDirectoryOverride = true;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    dbPath,
    outputDirectory,
    storageDirectory: hasStorageDirectoryOverride ? storageDirectory : join(dirname(dbPath), "storage"),
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text);
}

async function listJsonFiles(directoryPath: string): Promise<string[]> {
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true });
  const filePaths: string[] = [];

  for (const directoryEntry of directoryEntries) {
    const entryPath = join(directoryPath, directoryEntry.name);
    if (directoryEntry.isDirectory()) {
      const nestedFilePaths = await listJsonFiles(entryPath);
      filePaths.push(...nestedFilePaths);
      continue;
    }

    if (directoryEntry.isFile() && entryPath.endsWith(".json")) {
      filePaths.push(entryPath);
    }
  }

  filePaths.sort();
  return filePaths;
}

function extractCreatedTime(value: unknown): number {
  if (!isRecord(value)) {
    return 0;
  }

  const created = value.created;
  return typeof created === "number" ? created : 0;
}

function extractLegacySessionTitle(data: Record<string, unknown>): string {
  return getStringProperty(data, "title") ?? "untitled";
}

function printSummary(chunks: IExtractedMessage[][], outputDirectory: string): void {
  console.error("");
  console.error("=== Summary ===");
  console.error(`Created ${chunks.length} chunks in ${outputDirectory}/`);
  console.error("");

  console.log(`${"File".padEnd(20)} ${"Messages".padStart(10)} ${"Chars".padStart(12)}`);
  console.log(`${"----".padEnd(20)} ${"--------".padStart(10)} ${"-----".padStart(12)}`);

  for (const [index, chunk] of chunks.entries()) {
    const chars = chunk.reduce((totalChars, record) => totalChars + record.text.length, 0);
    const fileName = `chunk_${index}.jsonl`;
    console.log(`${fileName.padEnd(20)} ${String(chunk.length).padStart(10)} ${String(chars).padStart(12)}`);
  }
}

function chunkRecords(records: IExtractedMessage[]): IExtractedMessage[][] {
  const chunks: IExtractedMessage[][] = [];
  let currentChunk: IExtractedMessage[] = [];
  let currentSize = 0;

  for (const record of records) {
    const textLength = record.text.length;
    if (currentChunk.length > 0 && currentSize + textLength > CHUNK_SIZE) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(record);
    currentSize += textLength;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function clearExistingChunkFiles(outputDirectory: string): Promise<void> {
  if (!(await pathExists(outputDirectory))) {
    return;
  }

  const directoryEntries = await readdir(outputDirectory, { withFileTypes: true });
  const chunkFilePaths = directoryEntries
    .filter((directoryEntry) => directoryEntry.isFile() && /^chunk_\d+\.jsonl$/.test(directoryEntry.name))
    .map((directoryEntry) => join(outputDirectory, directoryEntry.name));

  await Promise.all(chunkFilePaths.map((chunkFilePath) => rm(chunkFilePath, { force: true })));
}

async function writeJsonLines(path: string, records: IExtractedMessage[]): Promise<void> {
  const lines = records.map((record) => JSON.stringify(record)).join("\n");
  const text = lines.length > 0 ? `${lines}\n` : "";
  await writeFile(path, text, "utf8");
}

function extractFromSqlite(path: string): { sessionCount: number; records: IExtractedMessage[] } {
  using database = new Database(path, { readonly: true, strict: true });

  const tableNameRows = database.query<ITableNameRow, []>("SELECT name FROM sqlite_master WHERE type = 'table'").all();
  const tableNames = new Set(tableNameRows.map((row) => row.name));
  const missingTableNames = ["session", "message", "part"].filter((tableName) => !tableNames.has(tableName));

  if (missingTableNames.length > 0) {
    throw new Error(`SQLite schema missing required tables: ${missingTableNames.sort().join(", ")}`);
  }

  const sessionCountRow = database
    .query<ISessionCountRow, []>("SELECT COUNT(*) AS session_count FROM session WHERE parent_id IS NULL")
    .get();
  const sessionCount = sessionCountRow?.session_count ?? 0;

  console.error(`Detected SQLite storage: ${path}`);
  console.error(`Found ${sessionCount} main sessions`);

  const records: IExtractedMessage[] = [];
  let currentMessageId: string | undefined;
  let currentSessionId: string | undefined;
  let currentSessionTitle = "untitled";
  let currentMessageTime = 0;
  let currentParts: string[] = [];

  const rows = database.query<IMessagePartRow, []>(`
    SELECT
      s.id AS session_id,
      COALESCE(s.title, 'untitled') AS session_title,
      m.id AS message_id,
      m.time_created AS message_time,
      json_extract(p.data, '$.text') AS part_text
    FROM session s
    JOIN message m ON m.session_id = s.id
    JOIN part p ON p.message_id = m.id
    WHERE s.parent_id IS NULL
      AND json_extract(m.data, '$.role') = 'user'
      AND json_extract(p.data, '$.type') = 'text'
    ORDER BY m.time_created, p.time_created
  `);

  for (const row of rows.iterate()) {
    if (currentMessageId && row.message_id !== currentMessageId) {
      flushRecord(records, currentSessionId, currentSessionTitle, currentMessageTime, currentParts);
      currentParts = [];
    }

    if (row.message_id !== currentMessageId) {
      currentMessageId = row.message_id;
      currentSessionId = row.session_id;
      currentSessionTitle = row.session_title;
      currentMessageTime = row.message_time;
    }

    if (typeof row.part_text === "string") {
      currentParts.push(row.part_text);
    }
  }

  flushRecord(records, currentSessionId, currentSessionTitle, currentMessageTime, currentParts);
  return { sessionCount, records };
}

async function extractFromLegacyStorage(path: string): Promise<{ sessionCount: number; records: IExtractedMessage[] }> {
  const sessionDirectoryPath = join(path, "session");
  const sessionFilePaths = (await pathExists(sessionDirectoryPath)) ? await listJsonFiles(sessionDirectoryPath) : [];
  const sessions = new Map<string, string>();

  for (const filePath of sessionFilePaths) {
    let data: unknown;
    try {
      data = await readJsonFile(filePath);
    } catch {
      continue;
    }

    if (!isRecord(data)) {
      continue;
    }

    if (data.parentID !== null && data.parentID !== undefined) {
      continue;
    }

    const sessionId = getStringProperty(data, "id");
    if (!sessionId) {
      continue;
    }

    sessions.set(sessionId, extractLegacySessionTitle(data));
  }

  console.error(`Detected legacy JSON storage: ${path}`);
  console.error(`Found ${sessions.size} main sessions`);

  const records: IExtractedMessage[] = [];

  for (const [sessionId, sessionTitle] of sessions) {
    const messageDirectoryPath = join(path, "message", sessionId);
    if (!(await pathExists(messageDirectoryPath))) {
      continue;
    }

    const messageFilePaths = await listJsonFiles(messageDirectoryPath);
    for (const messageFilePath of messageFilePaths) {
      let messageData: unknown;
      try {
        messageData = await readJsonFile(messageFilePath);
      } catch {
        continue;
      }

      if (!isRecord(messageData)) {
        continue;
      }

      if (getStringProperty(messageData, "role") !== "user") {
        continue;
      }

      const messageId = getStringProperty(messageData, "id");
      if (!messageId) {
        continue;
      }

      const messageTime = extractCreatedTime(messageData.time);
      const partDirectoryPath = join(path, "part", messageId);
      if (!(await pathExists(partDirectoryPath))) {
        continue;
      }

      const partFilePaths = await listJsonFiles(partDirectoryPath);
      const textParts: string[] = [];

      for (const partFilePath of partFilePaths) {
        let partData: unknown;
        try {
          partData = await readJsonFile(partFilePath);
        } catch {
          continue;
        }

        if (!isRecord(partData)) {
          continue;
        }

        if (getStringProperty(partData, "type") !== "text") {
          continue;
        }

        const text = getStringProperty(partData, "text");
        if (text) {
          textParts.push(text);
        }
      }

      flushRecord(records, sessionId, sessionTitle, messageTime, textParts);
    }
  }

  return { sessionCount: sessions.size, records };
}

async function extractRecords(args: IExtractArguments): Promise<{ sessionCount: number; records: IExtractedMessage[] }> {
  if (await pathExists(args.dbPath)) {
    try {
      return extractFromSqlite(args.dbPath);
    } catch (error) {
      if (await pathExists(args.storageDirectory)) {
        console.error(`SQLite extraction failed (${String(error)}); falling back to legacy JSON storage.`);
        return extractFromLegacyStorage(args.storageDirectory);
      }

      throw error;
    }
  }

  if (await pathExists(args.storageDirectory)) {
    return extractFromLegacyStorage(args.storageDirectory);
  }

  throw new Error("No OpenCode storage found. Expected either opencode.db or storage/ directory.");
}

async function main(): Promise<void> {
  const args = parseArguments(Bun.argv);
  const allMessagesFile = join(args.outputDirectory, "all_messages.jsonl");

  await mkdir(args.outputDirectory, { recursive: true });

  console.error("Extracting user messages...");
  const { records } = await extractRecords(args);
  records.sort((left, right) => left.timestamp - right.timestamp);

  await writeJsonLines(allMessagesFile, records);
  console.error(`Extracted ${records.length} messages (after filtering)`);

  await clearExistingChunkFiles(args.outputDirectory);

  if (records.length === 0) {
    printSummary([], args.outputDirectory);
    return;
  }

  console.error("Chunking messages...");
  const chunks = chunkRecords(records);

  await Promise.all(
    chunks.map((chunk, index) => writeJsonLines(join(args.outputDirectory, `chunk_${index}.jsonl`), chunk)),
  );

  printSummary(chunks, args.outputDirectory);
}

await main();
