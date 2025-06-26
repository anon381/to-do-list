import { loadDB, saveDB } from './_db.js';
import { randomUUID } from 'crypto';

function auth(req, res, db) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'missing token' }); return null; }
  const user = db.users.find(u => u.token === token);
  if (!user) { res.status(401).json({ error: 'invalid token' }); return null; }
  return user;
}

export default async function handler(req, res) {
  const db = loadDB();
  const user = auth(req, res, db);
  if (!user) return;

  if (req.method === 'GET') {
    return res.json({ todos: user.todos });
  }
  if (req.method === 'POST') {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  const todo = { id: randomUUID(), text: text.trim(), done: false, createdAt: new Date().toISOString() };
    user.todos.push(todo);
    saveDB(db);
    return res.status(201).json(todo);
  }
  if (req.method === 'DELETE') {
    const { completed } = req.query || {};
    if (completed === 'true') {
      user.todos = user.todos.filter(t => !t.done);
      saveDB(db);
    }
    return res.status(204).end();
  }
  return res.status(405).json({ error: 'method not allowed' });
}
