import type { MongoMemoryServer } from 'mongodb-memory-server';

declare global {
  var __MONGOD__: MongoMemoryServer | undefined;
}

/**
 * Uses MONGO_URI_TEST if provided (CI service container / local MongoDB), otherwise starts an
 * in-memory MongoDB. The import is lazy so runs against a real server never load
 * mongodb-memory-server (and the separate copy of the MongoDB driver it depends on).
 */
export default async function globalSetup(): Promise<void> {
  if (process.env['MONGO_URI_TEST']) return;
  const { MongoMemoryServer: Server } = await import('mongodb-memory-server');
  const mongod = await Server.create();
  globalThis.__MONGOD__ = mongod;
  process.env['MONGO_URI_TEST'] = mongod.getUri();
}
