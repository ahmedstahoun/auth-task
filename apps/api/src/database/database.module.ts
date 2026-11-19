import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from '../config/app-config';
import { BASE_MONGO_OPTIONS } from './mongo-client.options';
import { applyMongooseHardening } from './mongo-hardening';

/** Owns the MongoDB connection. Feature data access goes through RepositoriesModule. */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        applyMongooseHardening(); // before any model compiles or query runs
        return {
          ...BASE_MONGO_OPTIONS,
          uri: config.get('MONGO_URI'),
          // Builds the unique + TTL indexes on boot. In a larger system these would be migrations.
          autoIndex: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
