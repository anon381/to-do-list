import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'db.json');

export function loadDB() {
  if (!existsSync(dbPath)) writeFileSync(dbPath, JSON.stringify({ users: [] }, null, 2));
  return JSON.parse(readFileSync(dbPath, 'utf8'));
}

export function saveDB(db) { writeFileSync(dbPath, JSON.stringify(db, null, 2)); }
