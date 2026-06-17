#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import { join } from "node:path";

interface MatchResult {
  sourceTable: string;
  id: string;
  sessionId: string;
  timeCreated: number;
  content: string;
}

const DEFAULT_DATA_DIR = join(process.env.XDG_DATA_HOME ?? join(process.env.HOME ?? "", ".local", "share"), "opencode");
const DEFAULT_DB_PATH = join(DEFAULT_DATA_DIR, "opencode.db");

function printUsage(): void {
  console.log("Usage: bun scripts/search.ts <search-term> [--db <path-to-opencode.db>]");
}

function main() {
  const argv = process.argv;
  let searchTerm = "";
  let dbPath = DEFAULT_DB_PATH;

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--db" && i + 1 < argv.length) {
      dbPath = argv[i + 1];
      i++;
    } else if (argv[i].startsWith("--db=")) {
      dbPath = argv[i].split("=")[1];
    } else if (!argv[i].startsWith("-")) {
      searchTerm = argv[i];
    }
  }

  if (!searchTerm) {
    printUsage();
    process.exit(1);
  }

  const db = new Database(dbPath);
  console.log(`Searching database at ${dbPath} for '${searchTerm}'...`);

  const matches: MatchResult[] = [];

  // 1. Search message
  try {
    const rows = db.query("SELECT id, session_id, time_created, data FROM message WHERE data LIKE ?").all(`%${searchTerm}%`) as any[];
    for (const r of rows) {
      matches.push({
        sourceTable: "message",
        id: r.id,
        sessionId: r.session_id,
        timeCreated: r.time_created,
        content: r.data,
      });
    }
  } catch (e) {
    // Suppress error if table doesn't exist yet
  }

  // 2. Search part
  try {
    const rows = db.query("SELECT id, session_id, time_created, data FROM part WHERE data LIKE ?").all(`%${searchTerm}%`) as any[];
    for (const r of rows) {
      matches.push({
        sourceTable: "part",
        id: r.id,
        sessionId: r.session_id,
        timeCreated: r.time_created,
        content: r.data,
      });
    }
  } catch (e) {
    // Suppress error if table doesn't exist yet
  }

  // 3. Search session_message
  try {
    const rows = db.query("SELECT id, session_id, time_created, data FROM session_message WHERE data LIKE ?").all(`%${searchTerm}%`) as any[];
    for (const r of rows) {
      matches.push({
        sourceTable: "session_message",
        id: r.id,
        sessionId: r.session_id,
        timeCreated: r.time_created,
        content: r.data,
      });
    }
  } catch (e) {
    // Suppress error if table doesn't exist yet
  }

  // 4. Search session_input
  try {
    const rows = db.query("SELECT id, session_id, time_created, prompt FROM session_input WHERE prompt LIKE ?").all(`%${searchTerm}%`) as any[];
    for (const r of rows) {
      matches.push({
        sourceTable: "session_input",
        id: r.id,
        sessionId: r.session_id,
        timeCreated: r.time_created,
        content: r.prompt,
      });
    }
  } catch (e) {
    // Suppress error if table doesn't exist yet
  }

  // Sort matches chronologically
  matches.sort((a, b) => a.timeCreated - b.timeCreated);

  console.log(`\nFound ${matches.length} matching rows in total!`);

  if (matches.length > 0) {
    const uniqueSessions = new Map<string, { sessionInfo: any, firstMatchTime: number }>();

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      let sessionInfo: any = null;
      try {
        sessionInfo = db.query("SELECT title, slug, time_created FROM session WHERE id = ?").get(m.sessionId);
      } catch {}

      if (!uniqueSessions.has(m.sessionId)) {
        uniqueSessions.set(m.sessionId, {
          sessionInfo,
          firstMatchTime: m.timeCreated,
        });
      }
    }

    console.log("\n--- CHRONOLOGICAL SESSIONS MENTIONING TERM ---");
    const orderedSessions = Array.from(uniqueSessions.entries()).sort((a, b) => a[1].firstMatchTime - b[1].firstMatchTime);
    
    for (const [sid, data] of orderedSessions) {
      console.log(`\nSession ID: ${sid}`);
      if (data.sessionInfo) {
        console.log(`  Title: "${data.sessionInfo.title}"`);
        console.log(`  Slug:  "${data.sessionInfo.slug}"`);
        console.log(`  Created: ${new Date(data.sessionInfo.time_created).toISOString()}`);
      } else {
        console.log(`  Title/Slug: Not found in session table`);
      }
      console.log(`  First Mention: ${new Date(data.firstMatchTime).toISOString()} (timestamp: ${data.firstMatchTime})`);
    }
  } else {
    console.log("No matches found.");
  }
}

main();
