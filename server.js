import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { getUsersCollection, normalizeUser } from './api/_db.js';

const app = express();
app.use(cors());
app.use(express.json());

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/signup', asyncHandler(async (req, res) => {
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
  res.status(201).json({ token: user.token, name: user.name, email: user.email });
}));

app.post('/login', asyncHandler(async (req, res) => {
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
  res.json({ token: user.token, name: user.name || user.username, email: user.email || '' });
}));

app.use(asyncHandler(async (req, res, next) => {
  if (['/signup', '/login', '/health'].includes(req.path)) return next();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  const users = await getUsersCollection();
  const user = normalizeUser(await users.findOne({ token }));
  if (!user) return res.status(401).json({ error: 'invalid token' });
  if (!Array.isArray(user.todos)) {
    user.todos = [];
    await users.updateOne({ id: user.id }, { $set: { todos: [] } });
  }
  req.user = user;
  req.users = users;
  next();
}));

app.get('/todos', (req, res) => {
  res.json({ todos: req.user.todos });
});

app.post('/todos', asyncHandler(async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  const todo = { id: randomUUID(), text: text.trim(), done: false, createdAt: new Date().toISOString() };
  await req.users.updateOne({ id: req.user.id }, { $push: { todos: todo } });
  res.status(201).json(todo);
}));

app.patch('/todos/:id/toggle', asyncHandler(async (req, res) => {
  const todo = req.user.todos.find(t => t.id === req.params.id);
  if (!todo) return res.status(404).json({ error: 'not found' });
  const updatedTodo = { ...todo, done: !todo.done, updatedAt: new Date().toISOString() };
  const nextTodos = req.user.todos.map(item => item.id === req.params.id ? updatedTodo : item);
  await req.users.updateOne({ id: req.user.id }, { $set: { todos: nextTodos } });
  res.json(updatedTodo);
}));

app.delete('/todos/:id', asyncHandler(async (req, res) => {
  const before = req.user.todos.length;
  const nextTodos = req.user.todos.filter(t => t.id !== req.params.id);
  if (nextTodos.length === before) return res.status(404).json({ error: 'not found' });
  await req.users.updateOne({ id: req.user.id }, { $set: { todos: nextTodos } });
  res.status(204).end();
}));

app.delete('/todos', asyncHandler(async (req, res) => {
  const { completed } = req.query;
  if (completed === 'true') {
    const nextTodos = req.user.todos.filter(t => !t.done);
    await req.users.updateOne({ id: req.user.id }, { $set: { todos: nextTodos } });
  }
  res.status(204).end();
}));

app.use((err, _req, res, _next) => {
  console.error('Server error', err);
  res.status(500).json({ error: 'internal error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Mongo DB server listening on http://localhost:${PORT}`));
