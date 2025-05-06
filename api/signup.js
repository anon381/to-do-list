import { loadDB, saveDB } from './_db.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const db = loadDB();
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'username already taken' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = { id: randomUUID(), username, passwordHash, token: randomUUID(), todos: [] };
  db.users.push(user);
  saveDB(db);
  return res.status(201).json({ token: user.token, username: user.username });
}
