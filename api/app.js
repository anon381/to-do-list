import { getUsersCollection, normalizeUser } from './_db.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import url from 'url';

export default async function handler(req, res) {
  try {
  req.body = await parseJsonBody(req);
  const parsed = url.parse(req.url, true);
  
  const rawPath = parsed.query.path ? '/' + parsed.query.path : (parsed.pathname || '').replace(/^\/api/, '') || '/';
  const path = rawPath.replace(/\/+/g, '/');
    const method = req.method;

    // Simple CORS (optional for local testing)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    if (method === 'OPTIONS') return res.status(204).end();

  if (path === '/health') {
      return res.json({ ok: true, ts: new Date().toISOString() });
    }

    // Public auth endpoints
  if (path === '/signup' && method === 'POST') return signup(req, res);
  if (path === '/login' && method === 'POST') return login(req, res);

    // Auth required for remaining /todos routes
    if (path.startsWith('/todos')) {
      const users = await getUsersCollection();
      const user = await authenticate(req, res, users);
      if (!user) return; // response already sent

  if (path === '/todos' && method === 'GET') {
        return res.json({ todos: user.todos });
      }
  if (path === '/todos' && method === 'POST') {
        const { text } = req.body || {};
        if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
        const todo = { id: randomUUID(), text: text.trim(), done: false, createdAt: new Date().toISOString() };
        await users.updateOne({ id: user.id }, { $push: { todos: todo } });
        return res.status(201).json(todo);
      }
  if (path === '/todos' && method === 'DELETE') {
        const { completed } = parsed.query || {};
        if (completed === 'true') {
          const nextTodos = user.todos.filter(t => !t.done);
          await users.updateOne({ id: user.id }, { $set: { todos: nextTodos } });
        }
        return res.status(204).end();
      }
      // /todos/:id/toggle
      const toggleMatch = path.match(/^\/todos\/([^/]+)\/toggle$/);
  if (toggleMatch && method === 'PATCH') {
        const id = toggleMatch[1];
        const todo = user.todos.find(t => t.id === id);
        if (!todo) return res.status(404).json({ error: 'not found' });
        const updatedTodo = { ...todo, done: !todo.done, updatedAt: new Date().toISOString() };
        const nextTodos = user.todos.map(item => item.id === id ? updatedTodo : item);
        await users.updateOne({ id: user.id }, { $set: { todos: nextTodos } });
        return res.json(updatedTodo);
      }
      const deleteMatch = path.match(/^\/todos\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
        const id = deleteMatch[1];
        const before = user.todos.length;
        const nextTodos = user.todos.filter(t => t.id !== id);
        if (nextTodos.length === before) return res.status(404).json({ error: 'not found' });
        await users.updateOne({ id: user.id }, { $set: { todos: nextTodos } });
        return res.status(204).end();
      }
    }

    return res.status(404).json({ error: 'not found' });
  } catch (e) {
    console.error('API error', e);
    return res.status(500).json({ error: 'internal error' });
  }
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

async function authenticate(req, res, users) {
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

async function signup(req, res) {
  const { name, email, password, confirmPassword } = req.body || {};
  const normalizedName = String(name || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedName || !normalizedEmail || !password || !confirmPassword) {
    return res.status(400).json({ error: 'name, email, password, and confirm password are required' });
  }
  if (password !== confirmPassword) return res.status(400).json({ error: 'passwords do not match' });
  const users = await getUsersCollection();
  const existingUser = await users.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ error: 'email already registered' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = { id: randomUUID(), name: normalizedName, username: normalizedName, email: normalizedEmail, passwordHash, token: randomUUID(), todos: [] };
  await users.insertOne(user);
  return res.status(201).json({ token: user.token, name: user.name, email: user.email });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  const credential = String(email || '').trim().toLowerCase();
  if (!credential || !password) return res.status(400).json({ error: 'email and password required' });
  const users = await getUsersCollection();
  const user = normalizeUser(await users.findOne({ $or: [{ email: credential }, { username: credential }] }));
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'invalid credentials' });
  if (!user.token) {
    user.token = randomUUID();
    await users.updateOne({ id: user.id }, { $set: { token: user.token } });
  }
  return res.json({ token: user.token, name: user.name || user.username, email: user.email || '' });
}
