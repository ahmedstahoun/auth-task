import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { userDtoSchema, type UserDto } from '@auth/shared';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { zodToOpenApi } from '../common/openapi/zod-to-openapi';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile (protected)' })
  @ApiOkResponse({ schema: zodToOpenApi(userDtoSchema) })
  @ApiResponse({ status: 401, description: 'Missing, invalid or revoked access token' })
  async me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    const profile = await this.users.findById(user.id);
    if (!profile) throw new NotFoundException('User not found');
    return profile;
  }
}
