import { getUsersCollection, normalizeUser } from './_db.js';
import { randomUUID } from 'crypto';

async function auth(req, res, users) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'missing token' }); return null; }
  const user = normalizeUser(await users.findOne({ token }));
  if (!user) { res.status(401).json({ error: 'invalid token' }); return null; }
  if (!Array.isArray(user.todos)) {
    user.todos = [];
    await users.updateOne({ id: user.id }, { $set: { todos: [] } });
  }
  return user;
}

export default async function handler(req, res) {
  const users = await getUsersCollection();
  const user = await auth(req, res, users);
  if (!user) return;

  if (req.method === 'GET') {
    return res.json({ todos: user.todos });
  }
  if (req.method === 'POST') {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
    const todo = { id: randomUUID(), text: text.trim(), done: false, createdAt: new Date().toISOString() };
    await users.updateOne({ id: user.id }, { $push: { todos: todo } });
    return res.status(201).json(todo);
  }
  if (req.method === 'DELETE') {
    const { completed } = req.query || {};
    if (completed === 'true') {
      const nextTodos = user.todos.filter(t => !t.done);
      await users.updateOne({ id: user.id }, { $set: { todos: nextTodos } });
    }
    return res.status(204).end();
  }
  return res.status(405).json({ error: 'method not allowed' });
}
