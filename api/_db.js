import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

/*
 * Lightweight JSON “persistence” layer used by both the legacy Express server and
 * the consolidated serverless function. This deliberately avoids any async I/O
 * complexity because the data size is tiny (a handful of users + todos) and we
 * want deterministic writes before the function returns.
 *
 * Vercel specifics:
 *  - Runtime filesystem = read‑only except for /tmp.
 *  - Each cold start gets a fresh /tmp; subsequent warm invocations on the same
 *    instance keep the in‑memory module state AND the /tmp file, but new scaled
 *    instances won’t see prior writes. So this is ephemeral & NOT durable.
 *  - For real durability we’ll later swap this with an external DB (Mongo / Postgres).
 *
 * Local development:
 *  - We default to the project working directory so the file persists between
 *    restarts, making dev easier.
 */
const baseDir = process.env.DB_FILE_DIR || (process.env.VERCEL ? '/tmp' : process.cwd());
const dbPath = path.join(baseDir, 'db.json');

// Read (and lazily create) the database file. Always returns a valid shape.
export function loadDB() {
  try {
    if (!existsSync(dbPath)) writeFileSync(dbPath, JSON.stringify({ users: [] }, null, 2));
    return JSON.parse(readFileSync(dbPath, 'utf8'));
  } catch (e) {
    console.error('Failed to load DB file', e);
    return { users: [] }; // Fallback empty structure keeps rest of code simple
  }
}

// Persist the full DB object. Caller already mutated it in‑memory.
export function saveDB(db) {
  try {
    writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Failed to write DB file', e);
  }
}
