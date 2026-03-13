import { getUsersCollection, normalizeUser } from './_db.js';
import { buildTodoPayload, hasUserDataChanges, normalizeCustomCategories, normalizeUserDocument, shouldPersistCustomCategory } from './planner.js';

async function auth(req, res, users) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'missing token' }); return null; }
  const user = normalizeUser(await users.findOne({ token }));
  if (!user) { res.status(401).json({ error: 'invalid token' }); return null; }

  const normalized = normalizeUserDocument(user);
  if (hasUserDataChanges(user.projects, normalized.projects, user.todos, normalized.todos, user.customCategories, normalized.customCategories)) {
    await users.updateOne({ id: user.id }, { $set: { projects: normalized.projects, todos: normalized.todos, customCategories: normalized.customCategories } });
  }

  return { ...user, ...normalized };
}

export default async function handler(req, res) {
  const users = await getUsersCollection();
  const user = await auth(req, res, users);
  if (!user) return;

  if (req.method === 'GET') {
    return res.json({ todos: user.todos, projects: user.projects, customCategories: user.customCategories || [] });
  }

  if (req.method === 'POST') {
    const payload = buildTodoPayload(req.body, {}, user.projects[0]?.id);
    if (!payload.text) return res.status(400).json({ error: 'text required' });

    const now = new Date().toISOString();
    const nextOrder = user.todos
      .filter((todo) => todo.projectId === payload.projectId)
      .reduce((maxOrder, todo) => Math.max(maxOrder, todo.order), -1) + 1;

    const todo = {
      ...payload,
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
    };

    const nextTodos = [...user.todos, todo];
    const shouldStoreCategory = shouldPersistCustomCategory(todo.category);
    const nextCustomCategories = shouldStoreCategory
      ? normalizeCustomCategories([...(user.customCategories || []), todo.category])
      : (user.customCategories || []);

    await users.updateOne(
      { id: user.id },
      { $set: { todos: nextTodos, customCategories: nextCustomCategories } }
    );

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
