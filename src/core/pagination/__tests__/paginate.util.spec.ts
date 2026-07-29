import { paginate } from '../paginate.util';

describe('paginate', () => {
  it('should return all items when they fit within the limit', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

    const result = paginate(items, 10, (item) => `cursor-${item.id}`);

    expect(result.items).toEqual(items);
    expect(result.nextCursor).toBeNull();
  });

  it('should return null nextCursor when items equal the limit exactly', () => {
    const items = [{ id: 1 }, { id: 2 }];

    const result = paginate(items, 2, (item) => `cursor-${item.id}`);

    expect(result.items).toEqual(items);
    expect(result.nextCursor).toBeNull();
  });

  it('should truncate to limit and return nextCursor when there are more', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

    const result = paginate(items, 3, (item) => `cursor-${item.id}`);

    expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(result.nextCursor).toBe('cursor-3');
  });

  it('should return empty items when input is empty', () => {
    const result = paginate(
      [],
      10,
      (item: { id: number }) => `cursor-${item.id}`
    );

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});
