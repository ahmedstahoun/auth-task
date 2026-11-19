import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { userDtoSchema, type UserDto } from '@auth/shared';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { zodToOpenApi } from '../common/validation/openapi';
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
