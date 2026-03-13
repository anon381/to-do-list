import 'dotenv/config';
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI);
const dbName = process.env.MONGODB_DB || 'todo-list';

async function main() {
  await client.connect();
  const users = client.db(dbName).collection('users');

  try {
    await users.dropIndex('email_1');
    console.log('Dropped old email_1 index');
  } catch (error) {
    if (error.codeName !== 'IndexNotFound') throw error;
    console.log('email_1 index did not exist');
  }

  const cleanupResult = await users.updateMany(
    {},
    [
      {
        $set: {
          email: {
            $switch: {
              branches: [
                {
                  case: { $eq: [{ $type: '$email' }, 'string'] },
                  then: { $toLower: '$email' },
                },
              ],
              default: '$$REMOVE',
            },
          },
        },
      },
    ]
  );

  await users.createIndex(
    { email: 1 },
    { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
  );

  console.log(JSON.stringify({ matched: cleanupResult.matchedCount, modified: cleanupResult.modifiedCount }, null, 2));
}

main()
  .catch((error) => {
    console.error('Index fix failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.close();
  });
