import { consumeLots, Lot, LotStore } from '../lot';

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

describe('LotStore', () => {
  it('should consume from the front for FIFO', () => {
    const store = new LotStore(false);
    store.push(lot('1', '100'));
    store.push(lot('1', '200'));
    expect(store.consume('1')).toBe('100');
    expect(store.toLots()).toEqual([lot('1', '200')]);
  });

  it('should consume from the back for LIFO', () => {
    const store = new LotStore(true);
    store.push(lot('1', '100'));
    store.push(lot('1', '200'));
    expect(store.consume('1')).toBe('200');
    expect(store.toLots()).toEqual([lot('1', '100')]);
  });

  it('should keep the original lot order for a partial LIFO consumption', () => {
    const store = new LotStore(true);
    store.push(lot('1', '100'));
    store.push(lot('1', '200'));
    expect(store.consume('0.5')).toBe('100');
    expect(store.toLots()).toEqual([lot('1', '100'), lot('0.5', '200')]);
  });

  it('should consume across lots in acquisition order for FIFO', () => {
    const store = new LotStore(false);
    store.push(lot('1', '100'));
    store.push(lot('1', '200'));
    expect(store.consume('1.5')).toBe('200');
    expect(store.toLots()).toEqual([lot('0.5', '200')]);
  });

  it('should compute released basis exactly (0.1 x 0.2)', () => {
    const store = new LotStore(false);
    store.push(lot('0.1', '0.2'));
    expect(store.consume('0.1')).toBe('0.02');
    expect(store.toLots()).toEqual([]);
  });

  it('should return a zero released basis for an empty store', () => {
    expect(new LotStore(false).consume('1')).toBe('0');
    expect(new LotStore(true).consume('1')).toBe('0');
  });

  it('should return a zero released basis for a zero amount', () => {
    const store = new LotStore(false);
    store.push(lot('1', '100'));
    expect(store.consume('0')).toBe('0');
    expect(store.toLots()).toEqual([lot('1', '100')]);
  });

  it('should support repeated interleaved pushes and consumptions', () => {
    const store = new LotStore(false);
    store.push(lot('1', '100'));
    expect(store.consume('1')).toBe('100');
    store.push(lot('2', '200'));
    expect(store.consume('1')).toBe('200');
    expect(store.toLots()).toEqual([lot('1', '200')]);
  });

  it('should continue trading after a full sell-out', () => {
    const store = new LotStore(false);
    store.push(lot('1', '100'));
    expect(store.consume('1')).toBe('100');
    store.push(lot('2', '300'));
    expect(store.consume('1')).toBe('300');
    expect(store.toLots()).toEqual([lot('1', '300')]);
  });

  it('should consume a partially held LIFO lot before newer lots', () => {
    const store = new LotStore(true);
    store.push(lot('1', '100'));
    expect(store.consume('0.5')).toBe('50');
    store.push(lot('1', '200'));
    expect(store.consume('1')).toBe('200');
    expect(store.toLots()).toEqual([lot('0.5', '100')]);
  });

  it('should not alias the pushed lot objects', () => {
    const source = lot('1', '100');
    const store = new LotStore(false);
    store.push(source);
    source.quantity = '99';
    expect(store.consume('1')).toBe('100');
    expect(store.toLots()).toEqual([]);
  });

  it('should compact an exhausted FIFO prefix without losing lots', () => {
    const store = new LotStore(false);
    for (let i = 0; i < 3000; i++) {
      store.push(lot('1', '100'));
    }
    for (let i = 0; i < 2500; i++) {
      expect(store.consume('1')).toBe('100');
    }
    expect(store.toLots()).toEqual(
      Array.from({ length: 500 }, () => lot('1', '100'))
    );
  });
});
