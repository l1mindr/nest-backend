import { PaginatedResult } from './paginated-result.interface';

export function paginate<T>(
  items: T[],
  limit: number,
  encodeItem: (item: T) => string
): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? encodeItem(page[page.length - 1]) : null;
  return { items: page, nextCursor };
}
