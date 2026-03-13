import 'dotenv/config';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUsersCollection } from '../api/_db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourcePath = path.resolve(__dirname, '..', 'db.json');

async function main() {
  const raw = await readFile(sourcePath, 'utf8');
  const parsed = JSON.parse(raw);
  const users = Array.isArray(parsed.users) ? parsed.users : [];

  if (users.length === 0) {
    console.log('No users found in db.json');
    return;
  }

  const collection = await getUsersCollection();
  const operations = users
    .filter((user) => user && user.id)
    .map((user) => {
      const replacement = {
        ...user,
        todos: Array.isArray(user.todos) ? user.todos : [],
      };

      if (user.email) {
        replacement.email = String(user.email).toLowerCase();
      } else {
        delete replacement.email;
      }

      return {
        replaceOne: {
          filter: { id: user.id },
          replacement,
          upsert: true,
        },
      };
    });

  if (operations.length === 0) {
    console.log('No valid users to import');
    return;
  }

  const result = await collection.bulkWrite(operations, { ordered: false });
  console.log(`Imported ${operations.length} users`);
  console.log(JSON.stringify({ matched: result.matchedCount, modified: result.modifiedCount, upserted: result.upsertedCount }, null, 2));
}

main().catch((error) => {
  console.error('Seed failed', error);
  process.exitCode = 1;
});
