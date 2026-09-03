import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import { derivedHoldingId, HoldingsService } from '../holdings.service';

describe('HoldingsService', () => {
  const transactionRepository = {
    listForPnl: jest.fn(),
    listByPortfolioAndAsset: jest.fn()
  };
  const openingBalanceRepository = {
    listByPortfolioAndUser: jest.fn()
  };
  const assetRepository = {
    findById: jest.fn()
  };
  const holdingRepository = {
    listForValuation: jest.fn()
  };

  const asset = (id: string) => ({ id, symbol: 'btc', name: 'Bitcoin' });

  const tx = (
    type: PortfolioTransactionType,
    amount: string,
    occurredAt = '2026-01-01T00:00:00.000Z'
  ) => ({
    id: `tx-${type}-${amount}`,
    assetId: 'asset-id',
    type,
    amount,
    price: null,
    fee: null,
    occurredAt: new Date(occurredAt)
  });

  let service: HoldingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    transactionRepository.listForPnl.mockResolvedValue([]);
    transactionRepository.listByPortfolioAndAsset.mockResolvedValue([]);
    openingBalanceRepository.listByPortfolioAndUser.mockResolvedValue([]);
    holdingRepository.listForValuation.mockResolvedValue([]);
    assetRepository.findById.mockImplementation((id: string) =>
      Promise.resolve(asset(id))
    );

    service = new HoldingsService(
      transactionRepository as never,
      openingBalanceRepository as never,
      assetRepository as never,
      holdingRepository as never
    );
  });

  describe('getAssetQuantity', () => {
    it('adds BUY and TRANSFER_IN, subtracts SELL and TRANSFER_OUT', async () => {
      transactionRepository.listByPortfolioAndAsset.mockResolvedValue([
        tx(PortfolioTransactionType.TRANSFER_IN, '20'),
        tx(PortfolioTransactionType.BUY, '5'),
        tx(PortfolioTransactionType.SELL, '10'),
        tx(PortfolioTransactionType.TRANSFER_OUT, '3')
      ]);

      await expect(
        service.getAssetQuantity('portfolio-id', 'asset-id', 'user-id')
      ).resolves.toBe('12');
    });

    it('anchors the quantity on the asset opening balance', async () => {
      // The regression this guards: validating a SELL against a ledger that
      // ignores the opening balance rejects sales the user can actually make.
      openingBalanceRepository.listByPortfolioAndUser.mockResolvedValue([
        { assetId: 'asset-id', openingQuantity: '7' },
        { assetId: 'other-asset', openingQuantity: '99' }
      ]);
      transactionRepository.listByPortfolioAndAsset.mockResolvedValue([
        tx(PortfolioTransactionType.SELL, '2')
      ]);

      await expect(
        service.getAssetQuantity('portfolio-id', 'asset-id', 'user-id')
      ).resolves.toBe('5');
    });

    it('returns the opening balance when the asset has no transactions', async () => {
      openingBalanceRepository.listByPortfolioAndUser.mockResolvedValue([
        { assetId: 'asset-id', openingQuantity: '4' }
      ]);

      await expect(
        service.getAssetQuantity('portfolio-id', 'asset-id', 'user-id')
      ).resolves.toBe('4');
    });

    it('reports zero for an asset with no ledger and no opening balance', async () => {
      await expect(
        service.getAssetQuantity('portfolio-id', 'asset-id', 'user-id')
      ).resolves.toBe('0');
    });

    it('keeps full precision across many fractional digits', async () => {
      transactionRepository.listByPortfolioAndAsset.mockResolvedValue([
        tx(PortfolioTransactionType.TRANSFER_IN, '0.000000000000000003'),
        tx(PortfolioTransactionType.BUY, '0.000000000000000004'),
        tx(PortfolioTransactionType.SELL, '0.000000000000000001')
      ]);

      await expect(
        service.getAssetQuantity('portfolio-id', 'asset-id', 'user-id')
      ).resolves.toBe('0.000000000000000006');
    });

    it('does not lose precision the way float arithmetic would', async () => {
      transactionRepository.listByPortfolioAndAsset.mockResolvedValue([
        tx(PortfolioTransactionType.BUY, '0.1'),
        tx(PortfolioTransactionType.BUY, '0.2')
      ]);

      // 0.1 + 0.2 === 0.30000000000000004 in IEEE-754.
      await expect(
        service.getAssetQuantity('portfolio-id', 'asset-id', 'user-id')
      ).resolves.toBe('0.3');
    });
  });

  describe('getAssetQuantityExcluding', () => {
    it('replays the ledger as if the excluded transaction never existed', async () => {
      transactionRepository.listByPortfolioAndAsset.mockResolvedValue([
        tx(PortfolioTransactionType.BUY, '10'),
        { ...tx(PortfolioTransactionType.SELL, '4'), id: 'tx-being-edited' }
      ]);

      await expect(
        service.getAssetQuantityExcluding(
          'portfolio-id',
          'asset-id',
          'user-id',
          'tx-being-edited'
        )
      ).resolves.toBe('10');
    });

    it('anchors on the opening balance like getAssetQuantity does', async () => {
      openingBalanceRepository.listByPortfolioAndUser.mockResolvedValue([
        { assetId: 'asset-id', openingQuantity: '7' }
      ]);
      transactionRepository.listByPortfolioAndAsset.mockResolvedValue([
        { ...tx(PortfolioTransactionType.SELL, '2'), id: 'tx-being-edited' }
      ]);

      await expect(
        service.getAssetQuantityExcluding(
          'portfolio-id',
          'asset-id',
          'user-id',
          'tx-being-edited'
        )
      ).resolves.toBe('7');
    });
  });

  describe('canSell', () => {
    it.each([
      ['10', '10', true],
      ['10', '9.999999999999999999', true],
      ['10', '10.000000000000000001', false],
      ['0', '1', false]
    ])('holding %s against %s -> %s', (holding, requested, allowed) => {
      expect(service.canSell(holding, requested)).toBe(allowed);
    });
  });

  describe('getPortfolioHoldings', () => {
    it('derives one position per asset in the ledger', async () => {
      transactionRepository.listForPnl.mockResolvedValue([
        tx(PortfolioTransactionType.TRANSFER_IN, '20'),
        { ...tx(PortfolioTransactionType.BUY, '2'), assetId: 'asset-two' }
      ]);

      const result = await service.getPortfolioHoldings(
        'portfolio-id',
        'user-id'
      );

      expect(
        result.map((holding) => [holding.assetId, holding.amount])
      ).toEqual([
        ['asset-id', '20'],
        ['asset-two', '2']
      ]);
    });

    it('includes an asset that only has an opening balance', async () => {
      openingBalanceRepository.listByPortfolioAndUser.mockResolvedValue([
        { assetId: 'untraded', openingQuantity: '8', asset: asset('untraded') }
      ]);

      const result = await service.getPortfolioHoldings(
        'portfolio-id',
        'user-id'
      );

      expect(result).toEqual([
        expect.objectContaining({ assetId: 'untraded', amount: '8' })
      ]);
    });

    it('includes a manually-created holding the ledger has no entry for', async () => {
      holdingRepository.listForValuation.mockResolvedValue([
        {
          id: 'holding-id',
          portfolioId: 'portfolio-id',
          assetId: 'manual-asset',
          amount: '1.5',
          notes: 'Cold storage',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          asset: asset('manual-asset')
        }
      ]);

      const result = await service.getPortfolioHoldings(
        'portfolio-id',
        'user-id'
      );

      expect(result).toEqual([
        expect.objectContaining({
          id: 'holding-id',
          assetId: 'manual-asset',
          amount: '1.5',
          notes: 'Cold storage'
        })
      ]);
    });

    it('prefers the ledger over a manual holding for the same asset', async () => {
      transactionRepository.listForPnl.mockResolvedValue([
        tx(PortfolioTransactionType.BUY, '2')
      ]);
      holdingRepository.listForValuation.mockResolvedValue([
        {
          id: 'holding-id',
          portfolioId: 'portfolio-id',
          assetId: 'asset-id',
          amount: '999',
          notes: 'stale',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          asset: asset('asset-id')
        }
      ]);

      const result = await service.getPortfolioHoldings(
        'portfolio-id',
        'user-id'
      );

      expect(result).toEqual([
        expect.objectContaining({ assetId: 'asset-id', amount: '2' })
      ]);
    });

    it('loads the full asset rather than the projection P&L uses', async () => {
      transactionRepository.listForPnl.mockResolvedValue([
        tx(PortfolioTransactionType.BUY, '1')
      ]);

      const result = await service.getPortfolioHoldings(
        'portfolio-id',
        'user-id'
      );

      expect(assetRepository.findById).toHaveBeenCalledWith('asset-id');
      expect(result[0].asset).toEqual(asset('asset-id'));
    });

    it('gives a portfolio+asset pair a stable UUID-shaped id', async () => {
      transactionRepository.listForPnl.mockResolvedValue([
        tx(PortfolioTransactionType.BUY, '1')
      ]);

      const first = await service.getPortfolioHoldings(
        'portfolio-id',
        'user-id'
      );
      const second = await service.getPortfolioHoldings(
        'portfolio-id',
        'user-id'
      );

      expect(first[0].id).toBe(second[0].id);
      expect(first[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('gives different assets different ids', () => {
      expect(derivedHoldingId('p', 'a')).not.toBe(derivedHoldingId('p', 'b'));
      expect(derivedHoldingId('p1', 'a')).not.toBe(derivedHoldingId('p2', 'a'));
    });
  });
});
