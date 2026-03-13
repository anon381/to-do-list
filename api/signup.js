import { getUsersCollection } from './_db.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
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
