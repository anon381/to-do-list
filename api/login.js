import { getUsersCollection, normalizeUser } from './_db.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
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
