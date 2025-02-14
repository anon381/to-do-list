import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

function initDB() {
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify({ users: [] }, null, 2));
  }
}

function loadDB() {
  initDB();
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveDB(db) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function findUserByToken(db, token) {
  return db.users.find(u => u.token === token);
}

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Signup
app.post('/signup', (req, res) => {
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
  res.status(201).json({ token: user.token, username: user.username });
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const db = loadDB();
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'invalid credentials' });
  if (!user.token) { user.token = randomUUID(); saveDB(db); }
  res.json({ token: user.token, username: user.username });
});

// Auth middleware
app.use((req, res, next) => {
  if (['/signup', '/login', '/health'].includes(req.path)) return next();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  const db = loadDB();
  const user = findUserByToken(db, token);
  if (!user) return res.status(401).json({ error: 'invalid token' });
  req.user = user;
  req.db = db;
  next();
});

// Get todos
app.get('/todos', (req, res) => {
  res.json({ todos: req.user.todos });
});

// Add todo
app.post('/todos', (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  const todo = { id: randomUUID(), text: text.trim(), done: false, createdAt: new Date().toISOString() };
  req.user.todos.push(todo);
  saveDB(req.db);
  res.status(201).json(todo);
});

// Toggle todo
app.patch('/todos/:id/toggle', (req, res) => {
  const todo = req.user.todos.find(t => t.id === req.params.id);
  if (!todo) return res.status(404).json({ error: 'not found' });
  todo.done = !todo.done;
  todo.updatedAt = new Date().toISOString();
  saveDB(req.db);
  res.json(todo);
});

// Delete todo
app.delete('/todos/:id', (req, res) => {
  const before = req.user.todos.length;
  req.user.todos = req.user.todos.filter(t => t.id !== req.params.id);
  if (req.user.todos.length === before) return res.status(404).json({ error: 'not found' });
  saveDB(req.db);
  res.status(204).end();
});

// Clear completed
app.delete('/todos', (req, res) => {
  const { completed } = req.query;
  if (completed === 'true') {
    req.user.todos = req.user.todos.filter(t => !t.done);
    saveDB(req.db);
  }
  res.status(204).end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`JSON DB server listening on http://localhost:${PORT}`));
