import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'todo-list';

let indexesPromise;

function getClientPromise() {
  if (!uri) {
    throw new Error('Missing MONGODB_URI');
  }

  if (!globalThis.__todoListMongoClientPromise) {
    const client = new MongoClient(uri);
    globalThis.__todoListMongoClientPromise = client.connect();
  }

  return globalThis.__todoListMongoClientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  return client.db(dbName);
}

export async function getUsersCollection() {
  const db = await getDb();
  const users = db.collection('users');

  if (!indexesPromise) {
    indexesPromise = ensureIndexes(users);
  }

  await indexesPromise;
  return users;
}

async function ensureIndexes(users) {
  const existingIndexes = await users.indexes();
  const emailIndex = existingIndexes.find((index) => index.name === 'email_1');

  if (emailIndex && !emailIndex.partialFilterExpression) {
    await users.dropIndex('email_1');
  }

  await Promise.all([
    users.createIndex({ id: 1 }, { unique: true }),
    users.createIndex(
      { email: 1 },
      { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
    ),
    users.createIndex({ token: 1 }, { unique: true, sparse: true }),
  ]);
}

export function normalizeUser(user) {
  if (!user) return null;

  return {
    ...user,
    id: user.id || user._id?.toString(),
    todos: Array.isArray(user.todos) ? user.todos : [],
  };
}
