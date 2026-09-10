import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '@core/pagination/paginated-result.interface';
import {
  ACTIVITY_PAGE_SIZE_DEFAULT,
  ACTIVITY_PAGE_SIZE_MAX
} from '../../presentation/dto/request/list-user-activity.request.dto';
import {
  IListUserActivitiesUseCase,
  IUserActivityRepository,
  ListUserActivitiesQuery,
  USER_ACTIVITY_REPOSITORY,
  UserActivityItem
} from '../interfaces/activity.interface';
import { UserActivityMapper } from '../mappers/user-activity.mapper';

@Injectable()
export class ListUserActivitiesUseCase implements IListUserActivitiesUseCase {
  constructor(
    @Inject(USER_ACTIVITY_REPOSITORY)
    private readonly repository: IUserActivityRepository,
    private readonly mapper: UserActivityMapper
  ) {}

  /**
   * One page of the caller's own activities.
   *
   * `userId` arrives from the authenticated principal and is passed straight
   * to the repository filter, where it is not optional. Nothing in `query` can
   * reach it, so a `userId` query parameter — should a client send one — is
   * simply an unknown field and has no effect on the result.
   */
  async execute(
    userId: string,
    query: ListUserActivitiesQuery
  ): Promise<PaginatedResult<UserActivityItem>> {
    const limit = Math.min(
      query.limit ?? ACTIVITY_PAGE_SIZE_DEFAULT,
      ACTIVITY_PAGE_SIZE_MAX
    );

    const cursor = query.cursor
      ? this.mapper.decodeCursor(query.cursor)
      : undefined;

    // One more than the page: its presence is what tells us a next page
    // exists, without a second round trip for a count.
    const documents = await this.repository.findForUser({
      userId,
      category: query.category,
      cursor,
      limit: limit + 1
    });

    const hasMore = documents.length > limit;
    const page = hasMore ? documents.slice(0, limit) : documents;

    // The cursor is built from the last document rather than the last mapped
    // item, because it needs `_id`, which the item deliberately exposes only
    // as an opaque `id`.
    const nextCursor = hasMore
      ? this.mapper.encodeCursor(page[page.length - 1])
      : null;

    return {
      items: page.map((document) => this.mapper.toItem(document)),
      nextCursor
    };
  }
}
