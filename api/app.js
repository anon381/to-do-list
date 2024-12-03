import { loadDB, saveDB } from './_db.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import url from 'url';

export default async function handler(req, res) {
  try {
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
      const db = loadDB();
      const user = authenticate(req, res, db);
      if (!user) return; // response already sent

  if (path === '/todos' && method === 'GET') {
        return res.json({ todos: user.todos });
      }
  if (path === '/todos' && method === 'POST') {
        const { text } = req.body || {};
        if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
        const todo = { id: randomUUID(), text: text.trim(), done: false, createdAt: new Date().toISOString() };
        user.todos.push(todo); saveDB(db); return res.status(201).json(todo);
      }
  if (path === '/todos' && method === 'DELETE') {
        const { completed } = parsed.query || {};
        if (completed === 'true') { user.todos = user.todos.filter(t => !t.done); saveDB(db); }
        return res.status(204).end();
      }
      // /todos/:id/toggle
      const toggleMatch = path.match(/^\/todos\/([^/]+)\/toggle$/);
  if (toggleMatch && method === 'PATCH') {
        const id = toggleMatch[1];
        const todo = user.todos.find(t => t.id === id);
        if (!todo) return res.status(404).json({ error: 'not found' });
        todo.done = !todo.done; todo.updatedAt = new Date().toISOString(); saveDB(db); return res.json(todo);
      }
    }

    return res.status(404).json({ error: 'not found' });
  } catch (e) {
    console.error('API error', e);
    return res.status(500).json({ error: 'internal error' });
  }
}

function authenticate(req, res, db) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'missing token' }); return null; }
  const user = db.users.find(u => u.token === token);
  if (!user) { res.status(401).json({ error: 'invalid token' }); return null; }
  return user;
}

function signup(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const db = loadDB();
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'username already taken' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = { id: randomUUID(), username, passwordHash, token: randomUUID(), todos: [] };
  db.users.push(user); saveDB(db);
  return res.status(201).json({ token: user.token, username: user.username });
}

function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const db = loadDB();
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'invalid credentials' });
  if (!user.token) { user.token = randomUUID(); saveDB(db); }
  return res.json({ token: user.token, username: user.username });
}
