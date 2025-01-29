import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
const baseDir = process.env.DB_FILE_DIR || (process.env.VERCEL ? '/tmp' : process.cwd());
const dbPath = path.join(baseDir, 'db.json');

export function loadDB() {
  try {
    if (!existsSync(dbPath)) writeFileSync(dbPath, JSON.stringify({ users: [] }, null, 2));
    return JSON.parse(readFileSync(dbPath, 'utf8'));
  } catch (e) {
    console.error('Failed to load DB file', e);
    return { users: [] }; 
  }
}

export function saveDB(db) {
  try {
    writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Failed to write DB file', e);
  }
}
