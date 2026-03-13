import { getUsersCollection, normalizeUser } from '../../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'method not allowed' });
  const users = await getUsersCollection();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  const user = normalizeUser(await users.findOne({ token }));
  if (!user) return res.status(401).json({ error: 'invalid token' });
  const { id } = req.query;
  const todo = user.todos.find(t => t.id === id);
  if (!todo) return res.status(404).json({ error: 'not found' });
  const updatedTodo = { ...todo, done: !todo.done, updatedAt: new Date().toISOString() };
  const nextTodos = user.todos.map(item => item.id === id ? updatedTodo : item);
  await users.updateOne({ id: user.id }, { $set: { todos: nextTodos } });
  return res.json(updatedTodo);
}
