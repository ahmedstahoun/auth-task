import { MongoMemoryServer } from 'mongodb-memory-server';

declare global {
  var __MONGOD__: MongoMemoryServer | undefined;
}

/**
 * Uses MONGO_URI_TEST if provided (CI service container / local docker compose),
 * otherwise starts an in-memory MongoDB for the whole run.
 */
export default async function globalSetup(): Promise<void> {
  if (process.env['MONGO_URI_TEST']) return;
  const mongod = await MongoMemoryServer.create();
  globalThis.__MONGOD__ = mongod;
  process.env['MONGO_URI_TEST'] = mongod.getUri();
}
