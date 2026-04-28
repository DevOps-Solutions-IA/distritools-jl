import 'tests/helpers/test-env';

import { disconnectDatabase, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

async function main() {
  await resetDatabase();
  await seedBaseData();
  await disconnectDatabase();
}

void main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
