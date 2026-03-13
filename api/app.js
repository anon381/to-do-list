import { getUsersCollection, normalizeUser } from './_db.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import url from 'url';
import { buildTodoPayload, createProject, hasUserDataChanges, normalizeCustomCategories, normalizeUserDocument, reorderProjectTodos, shouldPersistCustomCategory, toggleTodoWithRecurrence } from './planner.js';

export default async function handler(req, res) {
  try {
    req.body = await parseJsonBody(req);
    const parsed = url.parse(req.url, true);
    const rawPath = parsed.query.path ? '/' + parsed.query.path : (parsed.pathname || '').replace(/^\/api/, '') || '/';
    const path = rawPath.replace(/\/+/g, '/');
    const method = req.method;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    if (method === 'OPTIONS') return res.status(204).end();

    if (path === '/health') {
      return res.json({ ok: true, ts: new Date().toISOString() });
    }

    if (path === '/signup' && method === 'POST') return signup(req, res);
    if (path === '/login' && method === 'POST') return login(req, res);

    const users = await getUsersCollection();
    const user = await authenticate(req, res, users);
    if (!user) return;

    if (path === '/todos' && method === 'GET') {
      return res.json({ todos: user.todos, projects: user.projects, customCategories: user.customCategories });
    }

    if (path === '/categories' && method === 'POST') {
      const name = String(req.body?.name || '').trim();
      if (!shouldPersistCustomCategory(name)) {
        return res.status(400).json({ error: 'Provide a valid custom category name' });
      }

      const nextCustomCategories = normalizeCustomCategories([...(user.customCategories || []), name]);
      await users.updateOne({ id: user.id }, { $set: { customCategories: nextCustomCategories } });
      return res.status(201).json({ customCategories: nextCustomCategories });
    }

    if (path === '/projects' && method === 'POST') {
      const project = createProject(req.body || {});
      const nextProjects = [...user.projects, project];
      await users.updateOne({ id: user.id }, { $set: { projects: nextProjects } });
      return res.status(201).json(project);
    }

    if (path === '/todos' && method === 'POST') {
      const payload = buildTodoPayload(req.body, {}, user.projects[0]?.id);
      if (!payload.text) return res.status(400).json({ error: 'text required' });

      const now = new Date().toISOString();
      const nextOrder = user.todos.filter((todo) => todo.projectId === payload.projectId).reduce((maxOrder, todo) => Math.max(maxOrder, todo.order), -1) + 1;
      const todo = {
        id: randomUUID(),
        ...payload,
        order: nextOrder,
        createdAt: now,
        updatedAt: now,
      };

      const nextTodos = [...user.todos, todo];
      const shouldStoreCategory = shouldPersistCustomCategory(todo.category);
      const nextCustomCategories = shouldStoreCategory
        ? normalizeCustomCategories([...(user.customCategories || []), todo.category])
        : user.customCategories;

      await users.updateOne({ id: user.id }, { $set: { todos: nextTodos, customCategories: nextCustomCategories } });
      return res.status(201).json(todo);
    }

    if (path === '/todos' && method === 'DELETE') {
      const { completed } = parsed.query || {};
      if (completed === 'true') {
        const nextTodos = user.todos.filter((todo) => !todo.done);
        await users.updateOne({ id: user.id }, { $set: { todos: nextTodos } });
      }
      return res.status(204).end();
    }

    if (path === '/todos/reorder' && method === 'PATCH') {
      const { projectId, orderedIds } = req.body || {};
      if (!projectId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
        return res.status(400).json({ error: 'projectId and orderedIds are required' });
      }

      const nextTodos = reorderProjectTodos(user.todos, projectId, orderedIds);
      await users.updateOne({ id: user.id }, { $set: { todos: nextTodos } });
      return res.json({ todos: nextTodos });
    }

    const toggleMatch = path.match(/^\/todos\/([^/]+)\/toggle$/);
    if (toggleMatch && method === 'PATCH') {
      const result = toggleTodoWithRecurrence(user.todos, toggleMatch[1]);
      if (!result) return res.status(404).json({ error: 'not found' });

      await users.updateOne({ id: user.id }, { $set: { todos: result.todos } });
      return res.json(result.todo);
    }

    const patchMatch = path.match(/^\/todos\/([^/]+)$/);
    if (patchMatch && method === 'PATCH') {
      const todo = user.todos.find((item) => item.id === patchMatch[1]);
      if (!todo) return res.status(404).json({ error: 'not found' });

      const payload = buildTodoPayload(req.body, todo, user.projects[0]?.id);
      if (!payload.text) return res.status(400).json({ error: 'text required' });

      const updatedTodo = { ...todo, ...payload, updatedAt: new Date().toISOString() };
      const nextTodos = user.todos.map((item) => item.id === patchMatch[1] ? updatedTodo : item);
      const shouldStoreCategory = shouldPersistCustomCategory(updatedTodo.category);
      const nextCustomCategories = shouldStoreCategory
        ? normalizeCustomCategories([...(user.customCategories || []), updatedTodo.category])
        : user.customCategories;

      await users.updateOne({ id: user.id }, { $set: { todos: nextTodos, customCategories: nextCustomCategories } });
      return res.json(updatedTodo);
    }

    const deleteMatch = path.match(/^\/todos\/([^/]+)$/);
    if (deleteMatch && method === 'DELETE') {
      const nextTodos = user.todos.filter((item) => item.id !== deleteMatch[1]);
      if (nextTodos.length === user.todos.length) return res.status(404).json({ error: 'not found' });
      await users.updateOne({ id: user.id }, { $set: { todos: nextTodos } });
      return res.status(204).end();
    }

    return res.status(404).json({ error: 'not found' });
  } catch (error) {
    console.error('API error', error);
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
  if (!token) {
    res.status(401).json({ error: 'missing token' });
    return null;
  }

  const user = normalizeUser(await users.findOne({ token }));
  if (!user) {
    res.status(401).json({ error: 'invalid token' });
    return null;
  }

  const normalized = normalizeUserDocument(user);
  if (hasUserDataChanges(user.projects, normalized.projects, user.todos, normalized.todos, user.customCategories, normalized.customCategories)) {
    await users.updateOne({ id: user.id }, { $set: { projects: normalized.projects, todos: normalized.todos, customCategories: normalized.customCategories } });
  }

  return { ...user, ...normalized };
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