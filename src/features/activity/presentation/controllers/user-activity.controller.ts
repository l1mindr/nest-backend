import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@features/security/decorators/user.decorator';
import { User as UserEntity } from '@features/users/domain/entities/user.entity';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import {
  IListUserActivitiesUseCase,
  LIST_USER_ACTIVITIES_USE_CASE
} from '../../application/interfaces/activity.interface';
import { ListUserActivityRequestDto } from '../dto/request/list-user-activity.request.dto';
import { UserActivityListResponseDto } from '../dto/response/user-activity-list.response.dto';
import { ApiListUserActivity } from '../swagger/activity.swagger';

@Controller({
  path: 'user/activity',
  version: '1'
})
@ApiTags(ApiTagName.ACTIVITY)
export class UserActivityController {
  constructor(
    @Inject(LIST_USER_ACTIVITIES_USE_CASE)
    private readonly listUserActivitiesUseCase: IListUserActivitiesUseCase
  ) {}

  /**
   * The account is `user.id` from the authenticated principal, passed as its
   * own argument. The DTO has no `userId` field, so there is no path by which
   * a query parameter could reach the repository filter — `?userId=` is an
   * unknown property and is stripped by the global validation pipe.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiListUserActivity()
  async listActivity(
    @User() user: UserEntity,
    @Query() dto: ListUserActivityRequestDto
  ): Promise<UserActivityListResponseDto> {
    const result = await this.listUserActivitiesUseCase.execute(user.id, {
      cursor: dto.cursor,
      limit: dto.limit,
      category: dto.category
    });

    return {
      items: result.items,
      nextCursor: result.nextCursor
    };
  }
}
