import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { TokensModule } from '../tokens/tokens.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // TokensModule + RepositoriesModule provide what JwtAuthGuard needs on GET /users/me.
  imports: [RepositoriesModule, TokensModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
