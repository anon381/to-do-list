import { getUsersCollection, normalizeUser } from '../../_db.js';
import { buildTodoPayload, normalizeCustomCategories, normalizeUserDocument, hasUserDataChanges, shouldPersistCustomCategory } from '../../planner.js';

async function auth(req, res, users) {
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

export default async function handler(req, res) {
  const users = await getUsersCollection();
  const user = await auth(req, res, users);
  if (!user) return;

  const { id } = req.query;
  const todo = user.todos.find((item) => item.id === id);

  if (req.method === 'PATCH') {
    if (!todo) return res.status(404).json({ error: 'not found' });

    const payload = buildTodoPayload(req.body, todo, user.projects[0]?.id);
    if (!payload.text) return res.status(400).json({ error: 'text required' });

    const updatedTodo = { ...todo, ...payload, updatedAt: new Date().toISOString() };
    const nextTodos = user.todos.map((item) => item.id === id ? updatedTodo : item);
    const shouldStoreCategory = shouldPersistCustomCategory(updatedTodo.category);
    const nextCustomCategories = shouldStoreCategory
      ? normalizeCustomCategories([...(user.customCategories || []), updatedTodo.category])
      : (user.customCategories || []);

    await users.updateOne(
      { id: user.id },
      { $set: { todos: nextTodos, customCategories: nextCustomCategories } }
    );

    return res.json(updatedTodo);
  }

  if (req.method === 'DELETE') {
    const nextTodos = user.todos.filter((item) => item.id !== id);
    if (nextTodos.length === user.todos.length) return res.status(404).json({ error: 'not found' });

    await users.updateOne({ id: user.id }, { $set: { todos: nextTodos } });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'method not allowed' });
}
