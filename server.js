import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { getUsersCollection, normalizeUser } from './api/_db.js';
import { buildTodoPayload, createProject, hasUserDataChanges, normalizeCustomCategories, normalizeUserDocument, reorderProjectTodos, shouldPersistCustomCategory, toggleTodoWithRecurrence } from './api/planner.js';

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
  if (existingUser) return res.status(409).json({ error: 'email already registered' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = {
    id: randomUUID(),
    name: normalizedName,
    username: normalizedName,
    email: normalizedEmail,
    passwordHash,
    token: randomUUID(),
    projects: [createProject({ name: 'Inbox' })],
    todos: [],
    customCategories: [],
  };

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

  const normalized = normalizeUserDocument(user);
  if (hasUserDataChanges(user.projects, normalized.projects, user.todos, normalized.todos, user.customCategories, normalized.customCategories)) {
    await users.updateOne({ id: user.id }, { $set: { projects: normalized.projects, todos: normalized.todos, customCategories: normalized.customCategories } });
  }

  req.user = { ...user, ...normalized };
  req.users = users;
  next();
}));

app.get('/todos', (req, res) => {
  res.json({ todos: req.user.todos, projects: req.user.projects, customCategories: req.user.customCategories });
});

app.post('/categories', asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!shouldPersistCustomCategory(name)) {
    return res.status(400).json({ error: 'Provide a valid custom category name' });
  }

  const nextCustomCategories = normalizeCustomCategories([...(req.user.customCategories || []), name]);
  await req.users.updateOne({ id: req.user.id }, { $set: { customCategories: nextCustomCategories } });
  res.status(201).json({ customCategories: nextCustomCategories });
}));

app.post('/projects', asyncHandler(async (req, res) => {
  const project = createProject(req.body || {});
  const nextProjects = [...req.user.projects, project];
  await req.users.updateOne({ id: req.user.id }, { $set: { projects: nextProjects } });
  res.status(201).json(project);
}));

app.post('/todos', asyncHandler(async (req, res) => {
  const defaultProjectId = req.user.projects[0]?.id;
  const payload = buildTodoPayload(req.body, {}, defaultProjectId);
  if (!payload.text) return res.status(400).json({ error: 'text required' });

  const now = new Date().toISOString();
  const nextOrder = req.user.todos.filter((todo) => todo.projectId === payload.projectId).reduce((maxOrder, todo) => Math.max(maxOrder, todo.order), -1) + 1;
  const todo = {
    id: randomUUID(),
    ...payload,
    order: nextOrder,
    createdAt: now,
    updatedAt: now,
  };

  const nextTodos = [...req.user.todos, todo];
  const shouldStoreCategory = shouldPersistCustomCategory(todo.category);
  const nextCustomCategories = shouldStoreCategory
    ? normalizeCustomCategories([...(req.user.customCategories || []), todo.category])
    : req.user.customCategories;

  await req.users.updateOne(
    { id: req.user.id },
    { $set: { todos: nextTodos, customCategories: nextCustomCategories } }
  );
  res.status(201).json(todo);
}));

app.patch('/todos/reorder', asyncHandler(async (req, res) => {
  const { projectId, orderedIds } = req.body || {};
  if (!projectId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: 'projectId and orderedIds are required' });
  }

  const nextTodos = reorderProjectTodos(req.user.todos, projectId, orderedIds);
  await req.users.updateOne({ id: req.user.id }, { $set: { todos: nextTodos } });
  res.json({ todos: nextTodos });
}));

app.patch('/todos/:id/toggle', asyncHandler(async (req, res) => {
  const result = toggleTodoWithRecurrence(req.user.todos, req.params.id);
  if (!result) return res.status(404).json({ error: 'not found' });

  await req.users.updateOne({ id: req.user.id }, { $set: { todos: result.todos } });
  res.json(result.todo);
}));

app.patch('/todos/:id', asyncHandler(async (req, res) => {
  const todo = req.user.todos.find((item) => item.id === req.params.id);
  if (!todo) return res.status(404).json({ error: 'not found' });

  const payload = buildTodoPayload(req.body, todo, req.user.projects[0]?.id);
  if (!payload.text) return res.status(400).json({ error: 'text required' });

  const updatedTodo = { ...todo, ...payload, updatedAt: new Date().toISOString() };
  const nextTodos = req.user.todos.map((item) => item.id === req.params.id ? updatedTodo : item);
  const shouldStoreCategory = shouldPersistCustomCategory(updatedTodo.category);
  const nextCustomCategories = shouldStoreCategory
    ? normalizeCustomCategories([...(req.user.customCategories || []), updatedTodo.category])
    : req.user.customCategories;

  await req.users.updateOne({ id: req.user.id }, { $set: { todos: nextTodos, customCategories: nextCustomCategories } });
  res.json(updatedTodo);
}));

app.delete('/todos/:id', asyncHandler(async (req, res) => {
  const nextTodos = req.user.todos.filter((item) => item.id !== req.params.id);
  if (nextTodos.length === req.user.todos.length) return res.status(404).json({ error: 'not found' });

  await req.users.updateOne({ id: req.user.id }, { $set: { todos: nextTodos } });
  res.status(204).end();
}));

app.delete('/todos', asyncHandler(async (req, res) => {
  const { completed } = req.query;
  if (completed === 'true') {
    const nextTodos = req.user.todos.filter((todo) => !todo.done);
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