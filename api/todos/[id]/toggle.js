// Endpoint: toggle a single todo's done state by ID
import { loadDB, saveDB } from '../../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'method not allowed' });
  const db = loadDB();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  const user = db.users.find(u => u.token === token);
  if (!user) return res.status(401).json({ error: 'invalid token' });
  const { id } = req.query;
  const todo = user.todos.find(t => t.id === id);
  if (!todo) return res.status(404).json({ error: 'not found' });
  todo.done = !todo.done;
  todo.updatedAt = new Date().toISOString();
  saveDB(db);
  return res.json(todo);
}
