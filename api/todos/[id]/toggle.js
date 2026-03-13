import { getUsersCollection, normalizeUser } from '../../_db.js';
import { toggleTodoWithRecurrence, normalizeUserDocument, hasUserDataChanges } from '../../planner.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'method not allowed' });
  const users = await getUsersCollection();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  const user = normalizeUser(await users.findOne({ token }));
  if (!user) return res.status(401).json({ error: 'invalid token' });

  const normalized = normalizeUserDocument(user);
  if (hasUserDataChanges(user.projects, normalized.projects, user.todos, normalized.todos, user.customCategories, normalized.customCategories)) {
    await users.updateOne({ id: user.id }, { $set: { projects: normalized.projects, todos: normalized.todos, customCategories: normalized.customCategories } });
  }

  const userData = { ...user, ...normalized };
  const { id } = req.query;
  const result = toggleTodoWithRecurrence(userData.todos, id);
  if (!result) return res.status(404).json({ error: 'not found' });

  await users.updateOne({ id: user.id }, { $set: { todos: result.todos } });
  return res.json(result.todo);
}
