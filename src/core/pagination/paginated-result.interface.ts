export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}
