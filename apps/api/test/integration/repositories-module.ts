import { MongooseModule } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { applyMongooseHardening } from '../../src/database/mongo-hardening';
import { RepositoriesModule } from '../../src/repositories/repositories.module';

export interface RepositoriesTestContext {
  moduleRef: TestingModule;
  connection: Connection;
  clear: () => Promise<void>;
  close: () => Promise<void>;
}

/** RepositoriesModule against a real MongoDB (per-file database from test/setup/env.ts). */
export async function createRepositoriesContext(): Promise<RepositoriesTestContext> {
  applyMongooseHardening();
  const moduleRef = await Test.createTestingModule({
    imports: [MongooseModule.forRoot(process.env['MONGO_URI'] ?? ''), RepositoriesModule],
  }).compile();
  const connection = moduleRef.get<Connection>(getConnectionToken());
  await Promise.all(Object.values(connection.models).map((model) => model.init()));
  return {
    moduleRef,
    connection,
    clear: async () => {
      await Promise.all(Object.values(connection.collections).map((c) => c.deleteMany({})));
    },
    close: async () => {
      await connection.dropDatabase();
      await moduleRef.close();
    },
  };
}
