import { consumeLots, Lot } from '../lot';

const lot = (quantity: string, unitCost: string): Lot => ({
  quantity,
  unitCost
});

describe('consumeLots', () => {
  it('should consume from the front for FIFO', () => {
    const result = consumeLots([lot('1', '100'), lot('1', '200')], '1', false);
    expect(result.releasedBasis).toBe('100');
    expect(result.remainingLots).toEqual([lot('1', '200')]);
  });

  it('should consume from the back for LIFO', () => {
    const result = consumeLots([lot('1', '100'), lot('1', '200')], '1', true);
    expect(result.releasedBasis).toBe('200');
    expect(result.remainingLots).toEqual([lot('1', '100')]);
  });

  it('should consume across multiple lots for FIFO', () => {
    const result = consumeLots(
      [lot('1', '100'), lot('1', '200')],
      '1.5',
      false
    );
    expect(result.releasedBasis).toBe('200');
    expect(result.remainingLots).toEqual([lot('0.5', '200')]);
  });

  it('should keep the original lot order for a partial LIFO consumption', () => {
    const result = consumeLots([lot('1', '100'), lot('1', '200')], '0.5', true);
    expect(result.releasedBasis).toBe('100');
    expect(result.remainingLots).toEqual([lot('1', '100'), lot('0.5', '200')]);
  });

  it('should compute released basis exactly (0.1 x 0.2)', () => {
    const result = consumeLots([lot('0.1', '0.2')], '0.1', false);
    expect(result.releasedBasis).toBe('0.02');
    expect(result.remainingLots).toEqual([]);
  });

  it('should return a zero released basis for an empty lot list', () => {
    const result = consumeLots([], '1', false);
    expect(result.releasedBasis).toBe('0');
    expect(result.remainingLots).toEqual([]);
  });

  it('should not mutate the input lots', () => {
    const lots = [lot('1', '100'), lot('1', '200')];
    const snapshot = JSON.parse(JSON.stringify(lots));
    consumeLots(lots, '1', false);
    expect(lots).toEqual(snapshot);
  });
});
